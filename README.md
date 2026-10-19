# 今天吃哪口 · 校园食堂点评推荐

校园食堂点评推荐工具的可交互体验版。采用简洁的暖白与陶土橙界面，支持桌面和手机访问。

## 访问网站

https://zqih.github.io/meituan-vibe/

## 页面文件

`index.html` 为入口，`style.css` 提供响应式样式，`app.js` 处理交互，`data.js` 存放示例数据。无需安装依赖或构建，直接用静态服务器预览。

## 已实现

- 按食堂、菜品类型、预算筛选，搜索菜名、窗口和标签。
- 推荐、新菜、避雷分类；首页常驻食堂和预算，其他条件按需展开。
- 菜品详情、具体点评、价格、辣度和预计等待时间。
- 收藏，保存与删除本机点评；刷新后保留。
- 一键从当前筛选条件下的4分以上菜品中选餐，直接给出结果；连续选择时尽量不重复。
- 默认展示6道菜，更多菜品按需加载；键盘操作、弹窗、空结果提示与浏览器存储失败提示。

## 演示范围

南湖大学、三个食堂、窗口、12道菜品的价格、评分、等待时间和点评均为虚构示例。照片仅为食物示意，并非对应菜品实拍。当前没有共享后端，新增点评和收藏仅保存于当前浏览器，不跨设备、不对其他访客公开。

## 图片来源

食物照片来自 Unsplash 与 Wikimedia Commons，下载后作为站内静态资源提供。新增中式菜品照片的作者、原图、许可和修改记录见 [assets/photo-sources.txt](assets/photo-sources.txt)。以下为原有 Unsplash 示意照片：

- https://images.unsplash.com/photo-1512058564366-18510be2db19 （米饭示意）
- https://images.unsplash.com/photo-1569718212165-3a8278d5f624 （汤面示意）
- https://images.unsplash.com/photo-1562967914-608f82629710 （鸡肉示意）
- https://images.unsplash.com/photo-1546069901-ba9599a7e63c （轻食示意）
- https://images.unsplash.com/photo-1563245372-f21724e3856d （面点示意）
- https://images.unsplash.com/photo-1544025162-d76694265947 （牛肉示意）
- https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2 （鱼肉示意）
- https://images.unsplash.com/photo-1547592180-85f173990554 （配餐示意）

## 部署与更新

GitHub Pages 从 `main` 分支的根目录发布。更新页面并提交到 `main` 后，等待 Pages 部署完成即可查看。
