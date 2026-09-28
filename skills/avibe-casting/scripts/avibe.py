#!/usr/bin/env python3
"""avibe casting client. Standard library only; package content is never executed."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import zipfile

MAX_ARCHIVE = 250 * 1024 * 1024
MAX_EXPANDED = 600 * 1024 * 1024
MAX_FILES = 1000

class ClientError(Exception):
    pass

class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        old, new = urllib.parse.urlsplit(req.full_url), urllib.parse.urlsplit(newurl)
        if (old.scheme, old.netloc) != (new.scheme, new.netloc):
            raise ClientError("Cross-origin redirect rejected; credentials were not forwarded")
        return super().redirect_request(req, fp, code, msg, headers, newurl)

def request(base, route, token, binary=False):
    parsed = urllib.parse.urlsplit(base)
    if parsed.scheme != 'https' and not (parsed.scheme == 'http' and parsed.hostname in ('localhost', '127.0.0.1', '::1')):
        raise ClientError('Use HTTPS, or HTTP on loopback for local development')
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ClientError('The base URL must be an origin without credentials or query parameters')
    headers = {'Accept': 'application/zip' if binary else 'application/json', 'User-Agent': 'avibe-casting/1.0'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(base.rstrip('/') + '/api/v1/' + route, headers=headers)
    try:
        with urllib.request.build_opener(SafeRedirect()).open(req, timeout=90) as response:
            raw = response.read(MAX_ARCHIVE + 1)
            if len(raw) > MAX_ARCHIVE:
                raise ClientError('Response exceeds size limit')
            return raw if binary else json.loads(raw)
    except urllib.error.HTTPError as e:
        message = 'HTTP ' + str(e.code)
        try:
            message += ': ' + json.loads(e.read(20000)).get('error', {}).get('message', 'Request failed')
        except (ValueError, UnicodeError):
            pass
        raise ClientError(message) from None
    except (urllib.error.URLError, TimeoutError):
        raise ClientError('Could not reach avibe. Check the service origin and network connection.') from None

def safe_name(name):
    parts = PurePosixPath(name).parts
    if (not name or '\\' in name or '\x00' in name or ':' in name or name.startswith('/')
            or any(p in ('..', '.') for p in parts) or str(PurePosixPath(name)) != name):
        raise ClientError('Unsafe archive filename')
    return name

def verify_package(files, prefix='', expected_manifest=None):
    key = prefix + 'manifest.json'
    if key not in files:
        raise ClientError('Missing manifest.json')
    try:
        manifest = json.loads(files[key])
    except (ValueError, UnicodeError):
        raise ClientError('Invalid package manifest') from None
    if expected_manifest is not None and manifest != expected_manifest:
        raise ClientError('Downloaded manifest does not match the inspected version')
    if manifest.get('schema') != 'avibe-character-v1':
        raise ClientError('Unsupported character package version')
    for field in ('package_id', 'character_id', 'look_id', 'identity_version', 'look_version', 'license'):
        if field not in manifest:
            raise ClientError('Incomplete manifest: ' + field)
    expected = {key}
    roles = set()
    for item in manifest.get('files', []):
        name = prefix + safe_name(item.get('path', ''))
        if name in expected:
            raise ClientError('Duplicate path in manifest')
        expected.add(name)
        roles.add(item.get('role'))
        if name not in files:
            raise ClientError('Missing package file: ' + name)
        if len(files[name]) != item.get('bytes'):
            raise ClientError('File size mismatch: ' + name)
        if hashlib.sha256(files[name]).hexdigest() != item.get('sha256'):
            raise ClientError('Checksum mismatch: ' + name)
    if not {'identity', 'front', 'back'}.issubset(roles):
        raise ClientError('Package is missing required identity/front/back references')
    if not {prefix+'persona.json', prefix+'LICENSE.json', prefix+'USAGE.md'}.issubset(expected):
        raise ClientError('Package is missing persona, usage or license documents')
    if json.loads(files[prefix+'LICENSE.json']) != manifest['license']:
        raise ClientError('License document differs from manifest')
    return manifest, expected

def install_archive(raw, output, expected_manifest=None, board=False):
    destination = Path(output).expanduser().absolute()
    if destination.exists() or destination.is_symlink():
        raise ClientError('Output path already exists; choose a new directory')
    files = {}
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            entries = archive.infolist()
            if len(entries) > MAX_FILES or sum(i.file_size for i in entries) > MAX_EXPANDED:
                raise ClientError('Archive exceeds extraction limits')
            names = set()
            for item in entries:
                name = safe_name(item.filename)
                if name in names or stat.S_ISLNK(item.external_attr >> 16) or item.is_dir():
                    raise ClientError('Duplicate, symlink or directory archive entry rejected')
                names.add(name)
                if item.file_size > 30*1024*1024:
                    raise ClientError('Individual file exceeds size limit')
                files[name] = archive.read(item)
    except zipfile.BadZipFile:
        raise ClientError('Invalid ZIP archive') from None
    if board:
        if 'cast.json' not in files:
            raise ClientError('Missing cast.json')
        cast = json.loads(files['cast.json'])
        if cast.get('schema') != 'avibe-cast-v1':
            raise ClientError('Unsupported cast format')
        expected, manifests = {'cast.json'}, []
        for entry in cast.get('entries', []):
            prefix = safe_name(entry['id']) + '/'
            manifest, keys = verify_package(files, prefix)
            if (manifest['package_id'] != entry['package_id'] or manifest['character_id'] != entry['character_id'] or manifest['look_id'] != entry['look_id']):
                raise ClientError('Cast role does not match its package')
            expected.update(keys)
            manifests.append(manifest)
    else:
        manifest, expected = verify_package(files, expected_manifest=expected_manifest)
        manifests = [manifest]
    if set(files) != expected:
        raise ClientError('Archive contains files not declared in its manifest')
    destination.parent.mkdir(parents=True, exist_ok=True)
    temp = Path(tempfile.mkdtemp(prefix='.avibe-', dir=destination.parent))
    try:
        for name, data in files.items():
            target = temp / name
            target.parent.mkdir(parents=True, exist_ok=True)
            with open(target, 'xb') as stream:
                stream.write(data)
        if destination.exists():
            raise ClientError('Output was created by another process; refusing to replace it')
        # Reserve the destination atomically. Move files inside our own new directory.
        destination.mkdir()
        try:
            for child in temp.iterdir():
                shutil.move(str(child), str(destination / child.name))
        except Exception:
            shutil.rmtree(destination)
            raise
    finally:
        shutil.rmtree(temp, ignore_errors=True)
    return {'output': str(destination), 'verified': True, 'packages': [{k: m[k] for k in ('package_id','character_id','identity_version','look_id','look_version','license')} for m in manifests]}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default=os.getenv('AVIBE_BASE_URL', 'http://localhost:3217'))
    sub = parser.add_subparsers(dest='command', required=True)
    search = sub.add_parser('search')
    search.add_argument('--query', default='')
    search.add_argument('--min-age', type=int)
    search.add_argument('--max-age', type=int)
    search.add_argument('--gender', choices=['woman','man','nonbinary'])
    search.add_argument('--purpose', choices=['personal','commercial','brand'])
    search.add_argument('--ready', action='store_true')
    search.add_argument('--cursor', type=int, default=0)
    inspect = sub.add_parser('inspect'); inspect.add_argument('character_id')
    for name in ('download','export-board'):
        command = sub.add_parser(name); command.add_argument('id'); command.add_argument('--purpose', required=True, choices=['personal','commercial','brand']); command.add_argument('--output', required=True)
    args = parser.parse_args(); token = os.getenv('AVIBE_TOKEN')
    try:
        if args.command == 'search':
            params = {'q': args.query, 'cursor':args.cursor}
            for field in ('min_age','max_age','gender','purpose'):
                if getattr(args, field) is not None: params[field] = getattr(args, field)
            if args.ready: params['ready'] = 'true'
            result = request(args.base_url, 'characters?' + urllib.parse.urlencode(params), token)
        elif args.command == 'inspect':
            result = request(args.base_url, 'characters/' + urllib.parse.quote(args.character_id, safe=''), token)
        else:
            if not token: raise ClientError('Set AVIBE_TOKEN to a read/download personal token from My space')
            ident = urllib.parse.quote(args.id, safe=''); purpose = urllib.parse.urlencode({'purpose':args.purpose})
            if args.command == 'download':
                manifest = request(args.base_url, 'packages/'+ident+'?'+purpose, token)
                raw = request(args.base_url, 'packages/'+ident+'/download?'+purpose, token, binary=True)
                result = install_archive(raw, args.output, manifest)
            else:
                raw = request(args.base_url, 'casting-boards/'+ident+'/export?'+purpose, token, binary=True)
                result = install_archive(raw, args.output, board=True)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (ClientError, OSError, ValueError, KeyError) as e:
        print(json.dumps({'error': str(e)}, ensure_ascii=False), file=sys.stderr); return 1
    return 0

if __name__ == '__main__':
    sys.exit(main())
