import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { cortexRouter } from "./routes/cortex/index.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";

export const app = express();
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.use("/api", cortexRouter);
app.use(notFoundHandler);
app.use(errorHandler);
