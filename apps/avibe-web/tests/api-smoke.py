"""Explicitly local demo integration acceptance; never runs against a live service."""
import hashlib, io, json, os, subprocess, tempfile, urllib.request, urllib.error, urllib.parse, zipfile
from pathlib import Path

origin=os.getenv('AVIBE_TEST_ORIGIN','http://localhost:3217')
assert urllib.parse.urlsplit(origin).hostname in ('localhost','127.0.0.1'), 'Local test only'

def call(route,method='GET',data=None,cookie=None,token=None,raw=None,content_type=None):
    headers={'Origin':origin}
    if cookie:headers['Cookie']=cookie
    if token:headers['Authorization']='Bearer '+token
    if data is not None:raw=json.dumps(data).encode();headers['Content-Type']='application/json'
    if content_type:headers['Content-Type']=content_type
    request=urllib.request.Request(origin+'/api/v1/'+route,data=raw,method=method,headers=headers)
    try:
        with urllib.request.urlopen(request,timeout=90) as response:
            body=response.read()
            return response.status,response.headers,json.loads(body) if 'application/json' in response.headers.get('Content-Type','') else body
    except urllib.error.HTTPError as error:return error.code,error.headers,error.read()

assert call('health')[2]['capabilities']['demo'], 'Refusing to test a live service'
def session():
    status,headers,data=call('auth/demo','POST',{})
    assert status==200
    return headers['Set-Cookie'].split(';')[0],data['user']

alice,a=session();bob,b=session()
profile={'name':{'zh':'隔离验收角色','en':'Private integration fixture'},'age':31,'gender':'woman','personality':{'zh':'沉稳','en':'Thoughtful'},'background':{'zh':'虚构测试人物','en':'Fictional test character'},'anchors':{'zh':'短发','en':'Short hair'},'license':'negotiation','license_text':{'zh':'需授权','en':'License required'}}
status,_,private=call('characters','POST',profile,cookie=alice);assert status==201
assert call('characters/'+private['id'],cookie=bob)[0]==404
assert private['id'] not in [c['id'] for c in call('characters',cookie=bob)[2]['items']]
status,_,revision=call('characters/'+private['id']+'/revisions','POST',{**profile,'age':32},cookie=alice);assert status==201 and revision['identity_version']==2
assert call('characters/'+private['id'],cookie=alice)[2]['age']==31

character=call('characters/lin-yue',cookie=alice)[2]
look=character['looks'][0];pack=look['package_id']
manifest=call('packages/'+pack+'?purpose=personal',cookie=alice)[2]
status,_,archive=call('packages/'+pack+'/download?purpose=personal',cookie=alice);assert status==200
with zipfile.ZipFile(io.BytesIO(archive)) as z:
    assert json.loads(z.read('manifest.json'))==manifest
    for item in manifest['files']:assert hashlib.sha256(z.read(item['path'])).hexdigest()==item['sha256']
assert call('packages/'+pack+'/download?purpose=commercial',cookie=alice)[0]==403
assert call('assets/'+look['assets'][0]['id'])[0]==404
status,_,conv=call('conversations','POST',{'character_id':'lin-yue','look_id':look['id']},cookie=alice);assert status==201
msg={'body':'Local integration message','client_id':'integration-dedup-001'}
first=call('conversations/'+conv['id']+'/messages','POST',msg,cookie=alice)[2]
second=call('conversations/'+conv['id']+'/messages','POST',msg,cookie=alice)[2]
assert first['id']==second['id']
assert len(call('conversations/'+conv['id']+'/messages',cookie=alice)[2]['items'])==1
assert call('conversations/'+conv['id']+'/messages',cookie=bob)[0]==404
assert call('conversations/'+conv['id']+'/messages','POST',{**msg,'client_id':'internal-note-fixture','internal':True},cookie=alice)[0]==403

boundary='avibeIntegrationBoundary'
image=Path('assets/demo/lin-yue-card.png').read_bytes()
multipart=(f'--{boundary}\r\nContent-Disposition: form-data; name="role"\r\n\r\nchat\r\n--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="fixture.png"\r\nContent-Type: image/png\r\n\r\n'.encode()+image+f'\r\n--{boundary}--\r\n'.encode())
status,_,asset=call('assets','POST',cookie=alice,raw=multipart,content_type='multipart/form-data; boundary='+boundary);assert status==201
assert call('conversations/'+conv['id']+'/messages','POST',{'asset_id':asset['id'],'client_id':'attachment-fixture-001'},cookie=alice)[0]==201
assert call('assets/'+asset['id'],cookie=bob)[0]==404

status,_,token=call('tokens','POST',{'name':'local-integration'},cookie=alice);assert status==201
assert call('conversations',token=token['token'])[0]==403
assert call('assets/'+asset['id'],token=token['token'])[0]==404
assert call('billing',token=token['token'])[0]==403
assert call('characters','POST',profile,token=token['token'])[0]==403
assert call('admin/overview',cookie=alice)[0]==403
assert call('billing/orders','POST',{'provider':'wechat','plan_id':'none'},cookie=alice)[0]==503
output=Path(tempfile.mkdtemp(prefix='avibe-verified-download-'))/'lin-yue'
env={**os.environ,'AVIBE_BASE_URL':origin,'AVIBE_TOKEN':token['token']}
client=Path('open-source/avibe-casting/scripts/avibe.py')
result=subprocess.run(['python3',str(client),'download',pack,'--purpose','personal','--output',str(output)],env=env,capture_output=True,text=True,check=True)
verified=json.loads(result.stdout);assert verified['verified'] and Path(verified['output']).is_dir()
assert json.loads((output/'manifest.json').read_text())==manifest
status,_,board=call('casting-boards','POST',{'name':'Skill export acceptance'},cookie=alice);assert status==201
assert call('casting-boards/'+board['id']+'/entries','POST',{'character_id':'lin-yue','look_id':look['id'],'role_name':'Lead'},cookie=alice)[0]==200
board_output=output.parent/'cast-board'
exported=subprocess.run(['python3',str(client),'export-board',board['id'],'--purpose','personal','--output',str(board_output)],env=env,capture_output=True,text=True,check=True)
assert json.loads(exported.stdout)['verified']
cast=json.loads((board_output/'cast.json').read_text());assert cast['entries'][0]['role_name']=='Lead'

assert call('tokens/'+token['id'],'DELETE',cookie=alice)[0]==200
assert call('packages/'+pack,token=token['token'])[0]==401
print(json.dumps({'passed':True,'checks':['account and asset isolation','immutable identity revision','website/skill byte equality','license enforcement','chat deduplication','chat attachment isolation','read-only token boundaries','token revocation','disabled live payment'],'verified_download':str(output)},ensure_ascii=False,indent=2))
