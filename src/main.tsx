import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider, App as AntApp } from "antd";
import zhCN from "antd/locale/zh_CN";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#167d8d",
          colorText: "#20394b",
          colorBorder: "#dae3e9",
          borderRadius: 7,
          fontFamily: '"Segoe UI", "Microsoft YaHei", sans-serif',
          controlHeight: 38,
        },
        components: {
          Table: { headerBg: "#f5f8fa", headerColor: "#71818c" },
          Button: { primaryShadow: "none" },
        },
      }}
    >
      <AntApp>
        <App />
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>,
);
