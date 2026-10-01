# avibe

面向 AI 视频创作者的数字达人选角平台。网站与 `avibe-casting` Skill 共用目录、固定版本角色包和授权检查。当前 `avibe.net` 仍运行静态公开预览；完整 Next.js 网站和专用数据库需在独立环境验收后发布。

## 本地运行

需要 Node.js 24、npm 和 Python 3.9+。

```sh
npm ci
cp .env.example .env.local
npm run dev
```

打开 http://localhost:3217 可见与当前 `avibe.net` 公开预览一致的首页视觉；点「发现角色」进入 `/discover`，再从侧栏访问选角板、创作工作室、商务消息和我的空间。在功能页点击「我的账号 → 进入本地演示」。演示账号彼此隔离，初始积分没有现金价值。演示仅监听本机，不能作为公网部署模式。

本地包含 8 位原创虚构成年人的展示图，以及林悦的完整身份／正面／背面／侧面角色包。其他人物明确标记为形象展示。图片仅供本地产品评估；用户提供的附件没有被复制为公共素材。

默认数据库位于 `.data/db`，私人素材位于 `.data/assets`。外接盘写入慢时，可通过 `AVIBE_DATA_DIR`、`AVIBE_ASSET_DIR` 指定本机目录。可在本机 `.env.local` 中指定更快的临时目录；本地数据库、素材和密钥文件不属于源码内容。

如果 macOS 的 Node 来自桌面应用内置运行时，原生模块可能因签名限制不能加载。请使用常规 Node 安装，例如当前机器的 `/usr/local/bin/node`：`PATH=/usr/local/bin:/usr/bin:/bin npm run dev`。

## 已实现的流程

- 中英界面、自然语言与硬条件搜索、模特卡片浏览、点赞、项目选角与剧本角色分配。
- 版本固定的角色包下载、批量选角包导出、SHA-256 校验、独立授权说明。
- 私人人设草稿、可编辑的 AI 人设补全与翻译、身份版本修订、候选面孔、多视图、展示图、服装参考与分阶段换装、单视图重做、投稿审核。
- PostgreSQL 生成队列、报价版本检查、积分冻结／扣除／失败解冻。
- 微信 Native 与支付宝页面支付适配、签名与金额校验、重复通知幂等入账、主动查单。
- 商务文字与图片消息、持久化历史、私有实时通知、断线轮询补齐、内部备注与接待分配。
- 运营审核、价格与套餐配置、单用户用途授权、可撤销 Skill 令牌。

没有 OpenAI Key 时可以保存草稿，但不会伪造生成结果或扣分。没有商户配置及启用的充值套餐时不开放真实充值。真实 Supabase、OpenAI 和支付服务必须在独立预发布环境完成联调后才能上线。

## 项目结构

| 路径                            | 职责                                          |
| ------------------------------- | --------------------------------------------- |
| `app/`、`src/components/`       | Next.js 网站与中英界面                        |
| `app/api/v1/[...path]/route.ts` | 版本化服务 API                                |
| `src/lib/`                      | 检索、资产授权、版本、生成、账本、支付        |
| `worker/index.ts`               | pg-boss 生成 Worker 与支付查单                |
| `supabase/migrations/`          | 数据库、RLS、私有存储与实时授权               |
| `open-source/avibe-casting/`    | 可单独开源的 Skill、Python 客户端、格式及示例 |
| `scripts/import-character.ts`   | 有授权的官方素材导入，默认待审核              |
| `tests/`                        | 领域逻辑、下载安全与网页验收                  |

## 检查与测试

```sh
npm run typecheck
npm test
npm run db:check
python3 -m unittest discover -s tests -p '*_test.py'
npm run build
# 先启动本地网站；E2E 使用已安装的 Chrome
npm run test:e2e
```

验证结果与真实服务的验收边界见 `docs/VALIDATION.md`，部署步骤见 `docs/DEPLOYMENT.md`。
当前首页视觉与功能页的对应关系见 `docs/VISUAL-CONTRACT.md`。完整 Next.js 服务仍须部署在独立地址并连接专用 Supabase 后，才能替换现在线上的静态预览；源码更新不会自动改变 `avibe.net`。

## 开源 Skill

网站内「探索 avibe Skill」可下载完整 ZIP。也可以把 `open-source/avibe-casting` 文件夹安装到支持本地脚本的 Agent 的 skills 目录。

在网站「我的空间」创建读取与下载令牌，通过本机环境变量提供。不要把令牌写进公开代码或聊天。

```sh
export AVIBE_BASE_URL=http://localhost:3217
# AVIBE_TOKEN 由自己的秘密管理方式设置
python3 open-source/avibe-casting/scripts/avibe.py search --query '约45岁、严肃的父亲，允许商业视频使用'
python3 open-source/avibe-casting/scripts/avibe.py inspect CHARACTER_ID
python3 open-source/avibe-casting/scripts/avibe.py download PACKAGE_ID --purpose personal --output ./cast/character
```

客户端默认只访问本机服务；正式部署后显式设置自己的服务域名。角色包文本始终作为数据处理，不执行其中的指令。下载目录存在时拒绝覆盖。

## 许可与方法来源

只有 `open-source/avibe-casting` 内的代码按其 MIT LICENSE 开源。网站与运营服务未授予开源许可。角色资产的许可由每个角色包的 `LICENSE.json` 单独说明，不能从代码许可推导图片使用权。

创作流程参考用户维护的 [vibe-casting](https://github.com/wuyinhust/vibe-casting)：身份锚点、衣柜、独立视图与角色卡。网站将其实现为分阶段任务，并未假设上游存在生成或检索 API。

## 数字达人资产护照

达人详情 → 资产护照。提供唯一登记编号、身份／造型版本、文件指纹、创作证据与分项许可材料审核；创作者补交私密证明，运营在后台审核。新角色包附带登记快照，旧包保持稳定。候选账号的护照仅运营可见。升级需执行 `004_asset_passports.sql`。流程和访问边界见 `docs/ASSET-PASSPORT.md`。
