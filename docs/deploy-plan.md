# pc-rebuild 部署方案

本方案只整理灰度上线步骤，不直接覆盖生产目录 `/srv/oca-source/opt/html`。所有命令先在本地构建，再上传到新目录，通过 Nginx 临时路径 `/pc-rebuild/` 验证。

## 1. 本地构建

在本项目目录执行：

```bash
cd /Users/w5/codex/老年评估/pc-rebuild
npm ci
npm run build
test -d dist && find dist -maxdepth 2 -type f | head
```

确认 `dist/index.html` 和 `dist/assets/` 已生成。

## 2. 备份当前生产前端

在服务器上备份现有生产目录，不做覆盖：

```bash
ssh <user>@<server> 'set -e
ts=$(date +%Y%m%d%H%M%S)
sudo mkdir -p /srv/oca-source/backups
sudo tar -C /srv/oca-source/opt -czf /srv/oca-source/backups/html-$ts.tar.gz html
sudo ls -lh /srv/oca-source/backups/html-$ts.tar.gz
'
```

如需记录当前 Nginx 配置：

```bash
ssh <user>@<server> 'set -e
ts=$(date +%Y%m%d%H%M%S)
sudo cp -a /etc/nginx/nginx.conf /srv/oca-source/backups/nginx.conf-$ts
sudo nginx -T > /srv/oca-source/backups/nginx-full-$ts.conf
'
```

## 3. 上传 dist 到灰度目录

创建独立灰度目录，避免替换 `/srv/oca-source/opt/html`：

```bash
ssh <user>@<server> 'set -e
sudo mkdir -p /srv/oca-source/opt/pc-rebuild
sudo chown -R <user>:<user> /srv/oca-source/opt/pc-rebuild
'
rsync -av --delete dist/ <user>@<server>:/srv/oca-source/opt/pc-rebuild/
ssh <user>@<server> 'find /srv/oca-source/opt/pc-rebuild -maxdepth 2 -type f | head'
```

## 4. 配置 Nginx 临时路径

新增或调整站点配置，让 `/pc-rebuild/` 指向灰度目录，并保留 `/prod-api/` 后端代理。示例：

```nginx
location ^~ /pc-rebuild/ {
    alias /srv/oca-source/opt/pc-rebuild/;
    try_files $uri $uri/ /pc-rebuild/index.html;
}

location ^~ /prod-api/ {
    proxy_pass http://127.0.0.1:8080/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

发布配置前先检查，再 reload：

```bash
ssh <user>@<server> 'sudo nginx -t'
ssh <user>@<server> 'sudo systemctl reload nginx'
```

## 5. 灰度验证

访问：

```text
https://<domain>/pc-rebuild/
```

验证项：

```bash
# 静态资源
curl -I https://<domain>/pc-rebuild/
curl -I https://<domain>/pc-rebuild/assets/

# 后端代理仍可用，实际登录建议通过浏览器或受控脚本执行
curl -I https://<domain>/prod-api/
```

人工或自动化验证：

1. 使用 `ry / OcaTest@2026` 登录。
2. 患者列表能加载。
3. 打开患者详情，能查看一般情况表。
4. 打开评估记录，能查看量表明细。
5. 打开“总报告预览”，确认患者基本信息、量表结果和上次评估字段展示。
6. 点击“总报告打印”，确认 PDF 能打开或下载。

## 6. 回滚

灰度路径回滚只需要移除临时 Nginx 配置或切回旧灰度目录，不影响生产目录：

```bash
ssh <user>@<server> 'set -e
sudo rm -rf /srv/oca-source/opt/pc-rebuild
sudo nginx -t
sudo systemctl reload nginx
'
```

如果误改了 Nginx 配置，从备份恢复：

```bash
ssh <user>@<server> 'set -e
sudo cp -a /srv/oca-source/backups/nginx.conf-<timestamp> /etc/nginx/nginx.conf
sudo nginx -t
sudo systemctl reload nginx
'
```

如果未来经过确认要回滚生产静态目录，可从备份包恢复，但本方案不执行生产替换：

```bash
ssh <user>@<server> 'set -e
sudo rm -rf /srv/oca-source/opt/html.rollback-tmp
sudo mkdir -p /srv/oca-source/opt/html.rollback-tmp
sudo tar -C /srv/oca-source/opt/html.rollback-tmp -xzf /srv/oca-source/backups/html-<timestamp>.tar.gz
sudo rsync -av --delete /srv/oca-source/opt/html.rollback-tmp/html/ /srv/oca-source/opt/html/
sudo nginx -t
sudo systemctl reload nginx
'
```

