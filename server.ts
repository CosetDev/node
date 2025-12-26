require("dotenv").config();

import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import express, { type Application } from "express";

import publicRoutes from "./routes";

import { socketServer } from "./socket";
import { SocketListeners } from "./socket/listeners";

const app: Application = express();
const server = require("http").createServer(app);

app.set("trust proxy", 1);
app.use(cors({ origin: "*" }));
app.use(helmet());
app.use(express.json());
app.use(cookieParser());

// Routes
app.use("/", publicRoutes);

// Socket.io
const io = socketServer(server);
new SocketListeners(io);
(app as any).set("io", io); // Expose io for routes broadcast usage

// Start the server
async function start() {
    try {
        if (!process.env.MONGO_URI) throw new Error("Missing MONGO_URI env var");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");
    } catch (err) {
        console.error("MongoDB connection error", err);
        process.exit(1);
    }

    server.listen(process.env.SERVER_PORT, () =>
        console.log(`Coset Relayer Node is running on port ${process.env.SERVER_PORT}`),
    );
}

start();
