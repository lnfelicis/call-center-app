import { config } from "dotenv";

config();

const { startServer } = await import("./bootstrap.js");
startServer();
