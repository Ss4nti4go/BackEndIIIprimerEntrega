import express from "express";
import dbConnect from "./src/helpers/dbConnect.helper.js";
import "./src/helpers/env.js";
import indexRouter from "./src/routers/index.router.js";
import pathHandler from "./src/middlewares/pathHandler.mid.js";
import argvs from "./src/helpers/arguments.helper.js";
import errorHandler from "./src/middlewares/errorHandler.mid.js";
import setResponses from "./src/middlewares/setResponses.mid.js";
import { cpus } from "os";
import cluster from "cluster";
import logger from "./src/helpers/logger.helper.js";
import winston from "./src/middlewares/winston.mid.js";
import {serve, setup} from "swagger-ui-express";
import swaggerSpecs from "./src/helpers/swagger.helper.js";
import cookieParser from "cookie-parser";
import path from "path";
import handlebars from 'express-handlebars';
const server = express();
const port = process.env.PORT || 8080;
const ready = async () => {
    await dbConnect(process.env.LINK_DB);
    server.listen(port, () => logger.INFO(`Server listening on port ${port} and mode ${argvs.mode}`));
}
const isPrimary = cluster.isPrimary;
if (isPrimary) {
    const numCPUs = cpus().length;
    logger.INFO(`Primary ${process.pid} is running`);
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }
    cluster.on("exit", (worker, code, signal) => {
        logger.INFO(`worker ${worker.process.pid} died`);
    });
} else {

    server.listen(port, ready);
}
const SRC = path.join(path.resolve(), 'src');
server.engine('handlebars', handlebars.engine());
server.set('views', path.join(SRC, 'views')); 
server.set('view engine', 'handlebars');

server.use(express.json());
server.use(express.urlencoded({ extended: true }));
server.use(express.static("public"));
server.use(cookieParser());
server.use(winston);
server.use("/api/docs", serve, setup(swaggerSpecs));
server.use(setResponses);
server.use("/", indexRouter);
server.use(pathHandler);
server.use(errorHandler);



server.use((err, req, res, next) => {
   const status = err.statusCode || 500;
    const message = err.message || "Unexpected error";

    // No mostrar stack en consola (solo mensaje)
    logger.ERROR(`${req.method} ${req.originalUrl} -> ${message}`);

    res.status(status).json({
        error: message,
        status,
        method: req.method,
        url: req.originalUrl
    });
});