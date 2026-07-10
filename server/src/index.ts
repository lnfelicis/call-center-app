import cors from "cors";
import "dotenv/config";
import express from "express";
import { authRoutes } from "./routes/authRoutes.js";
import { adminRoutes } from "./routes/adminRoutes.js";
import { callRoutes } from "./routes/callRoutes.js";
import { logRoutes } from "./routes/logRoutes.js";
import { notificationRoutes } from "./routes/notificationRoutes.js";
import { reportRoutes } from "./routes/reportRoutes.js";
import { roleRoutes } from "./routes/roleRoutes.js";
import { settingRoutes } from "./routes/settingRoutes.js";
import { userRoutes } from "./routes/userRoutes.js";

const app = express();
const port = Number(process.env.PORT) || 3000;

if (process.env.RENDER === "true") {
  app.set("trust proxy", true);
}

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRoutes);
app.use(adminRoutes);
app.use(reportRoutes);
app.use(callRoutes);
app.use(roleRoutes);
app.use(settingRoutes);
app.use(userRoutes);
app.use(logRoutes);
app.use(notificationRoutes);

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(error);
    res.status(500).json({ message: "Beklenmeyen bir hata oluştu." });
  },
);

app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on http://localhost:${port}`);
});
