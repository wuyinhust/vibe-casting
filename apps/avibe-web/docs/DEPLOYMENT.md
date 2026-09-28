# 独立预发布与正式上线

## 配置顺序

1. 新建专用 Supabase 项目。保留现有 avibe.net 的网站、数据和 DNS；本项目不迁移任何已有业务。
2. 在 SQL 编辑器依次执行 `001_core.sql`、`002_access.sql`。第二份迁移包含策略和触发器，首次部署执行一次。数据库直连凭据仅提供给网站服务与 Worker；浏览器只能得到项目 URL 与 anon key。
3. Storage 使用 `avibe-private` 私有桶。不要给角色原图添加公开桶或浏览器下载策略；网站通过授权 API 返回文件。更换桶名需要同步修改迁移与环境变量。
4. 开启邮箱 OTP，把 Supabase 的邮箱登录邮件模板配置为显示 `{{ .Token }}`。配置预发布 URL 与允许回跳地址。网站使用自己的 HttpOnly 会话 Cookie；实时客户端使用 Supabase 登录会话。
5. 设置 `AVIBE_MODE=live`、`APP_ORIGIN=https://独立预发布域名`、`DATABASE_URL`、Supabase URL/anon/service-role key。所有私密 Key 放到部署平台秘密管理器。
6. 执行 `npm ci && npm run build`，部署网站及独立 Worker。Worker 执行 `npm run worker`，必须保持长驻。默认端口 3217；容器监听 0.0.0.0，前方使用 HTTPS 反向代理。Docker 构建时传入两个 `NEXT_PUBLIC_SUPABASE_*` build args。
7. 首个运营账号先正常邮箱登录，再由服务器运维执行 `npm run staff:promote -- 邮箱 admin`。该脚本需数据库权限，网站没有自助提权接口。`staff` 可审核和接待；`admin` 可配置价格、套餐与授权。
8. 配置 OpenAI Key 与模型名称。图像模型由 `OPENAI_IMAGE_MODEL` 控制；上线前用实际账号验证模型可用性。执行一组付费小样，测量身份稳定性、服装细节、耗时与实际用量。后台默认价格为关闭状态，金额仅是待配置占位，不能当作经过成本测算的售价。
9. 导入已获授权的角色，或通过网站生成私人角色后投稿。`npm run import:character -- ./authorized-character.json` 导入的素材一律待审核；发生中途错误时保留私人部分资产，不发布不完整包。正式目录不要导入本地演示图片。
10. 配置微信／支付宝商户参数与回调 HTTPS URL，在沙箱或商户测试流程验证签名、金额、重复回调、主动查单和到账后，再设置 `PAYMENTS_ENABLED=true` 并启用真实套餐。仅“打开支付开关”不足以通过验收。

## 运行服务

网站与 Worker 使用同一数据库及私有桶。网站事务插入生成任务并冻结积分；Worker 将持久化待派发任务送入 pg-boss。任务原子领取，结算幂等。生成阶段失败释放整阶段额度，部分图片留在私人存储，不发布。超过 30 分钟无进展的运行任务、超过 2 小时未运行的排队任务会释放额度。提供方结果不明确时不自动重发付费请求。

本地演示使用 Next.js `after()`，只适合本机演示；它不能代替正式 Worker。生产默认不启用演示账号和积分。

支付通知地址：

- `/api/v1/billing/webhooks/wechat`
- `/api/v1/billing/webhooks/alipay`

微信使用商户私钥、证书序列号、平台验签公钥及 API v3 AES 密钥；轮换时同步更新匹配的公钥序列号。支付宝使用 RSA2 私钥与支付宝公钥，生产与沙箱 gateway 不混用。服务端从签名通知或已验签的主动查单入账，前端“已完成付款”只触发查询。

## 发布前仍需实测

| 项目        | 必须留下的证据                                                       |
| ----------- | -------------------------------------------------------------------- |
| OpenAI 生成 | 真实候选、多视图、换装与重做样本；各阶段实际用量及耗时               |
| 人物一致性  | 人工检查脸型、年龄感、体型、正背侧服装；身份漂移不通过审核           |
| 服装准确性  | 轮廓、图案、颜色和背面细节；缺背面参考时显示推测标记                 |
| Supabase    | 两个真实邮箱账号的 RLS、私有桶和私有实时频道隔离                     |
| 支付        | 两个商户渠道真实或官方沙箱订单；到账一次、金额错拒绝、断回调查单恢复 |
| 发布与版本  | 私人身份修订不改变公共目录，旧角色包可继续按版本获取                 |
| 内容授权    | 原始来源、授权文本、商业内容与品牌合作权限分别审核                   |
| 运维        | 数据库备份、私有桶备份、Worker 进程管理、错误日志与用量告警          |

以上实测未完成前保持预发布状态。代码中没有自动执行域名切换或正式发布的命令。

## 规模与当前边界

检索当前读取可见候选，用硬条件过滤后执行双语关键词及可选向量排序。`npm run search:reindex` 为公开角色补充向量；没有模型服务时回退关键词并在响应标记排序方式。大规模目录应把候选过滤与近邻检索下推 PostgreSQL/pgvector，并建立离线中英检索评估集。

生成验收目前是人工查看与明确确认，未宣称有经过标定的自动人脸一致性判定器。聊天历史由服务端持久化，实时事件只负责唤醒，断线使用轮询补齐。附件经过图片解码和重编码后存储。

服装品牌、SKU、颜色、品类及正背参考可作为资产 metadata 保存；本版提供参考图上传和正背方向选择，企业自助衣库与交易留待后续。

## API 与导入

API 使用 `/api/v1`，错误结构为 `{error:{code,message,details?}}`。Skill 接口说明位于开源目录的 `references/api.md`。人设修订：`POST /characters/:id/revisions`，读取私人版本：`GET /characters/:id/revisions`。生成请求显式传 `identity_version`，并携带报价的 `expected_price_version`、`expected_credits` 及唯一 `idempotency_key`。

官方导入 JSON 字段定义见 `scripts/import-character.ts` 的 Zod schema：双语姓名、人设、身份锚点、年龄、性别、标签、许可、`source`、`rights_confirmed:true`、双语造型名与说明，以及 `images` 下的 `identity/front/back/showcase` 文件路径；`side` 可选。路径相对于该 JSON 文件解析。`rights_confirmed` 是运营登记，不替代实际授权文件。

接口参考：[支付宝交易查询官方说明](https://developer.alibaba.com/docs/doc.htm?articleId=757&docType=4&treeId=180)、[OpenAI 图像生成](https://developers.openai.com/api/docs/guides/image-generation)、[Supabase 实时授权](https://supabase.com/docs/guides/realtime/authorization)。支付适配器仍须按上述商户验收步骤实测。

## 私人运营候选资料

Creator-account prospecting records, source snapshots and evaluation notes are private operational data. Keep imported source files and local database exports outside the public repository. A lead is not a public character asset and must not receive display, download or commercial rights until the identity, image source and applicable permissions are reviewed.
