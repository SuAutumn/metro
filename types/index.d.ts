declare module "*.jpg";
declare module "*.jpeg";
declare module "*.svg";
declare module "*.gif";
declare module "*.webp";
// 声明 .png 文件模块
declare module "*.png" {
  const path: string;
  export default path;
}

declare module "*.less" {
  const classes: { [key: string]: string };
  export default classes;
}
