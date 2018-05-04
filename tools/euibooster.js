"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
/**
 * Created by jackyanjiaqi on 16/7/4.
 */
//import xml = require("./xml/index")
const CONFIG = require("./config");
const path = require("path");
//全局配置项目根目录
CONFIG.setDir(path.resolve(__dirname, "../"));
const file = require("./file");
// import euiParser = require("./parser");
const exml_service = require("./exml-service/componentScanner");
const themeParser = require("./themeParser");
const exmlParser = require("./eui/parser/EXMLParser");
const crcFilter = require("./crcFilter");
var parser = new exmlParser.EXMLParser();

//hackparser
const cfg = require("./eui/parser/EXMLConfig");
var OLD_ADDIDS = parser.addIds;
parser.addIds = function(items) {
    //遍历所有的items，处理含有slots节点的
    if (items) {
        for (var i = 0, len = items.length; i < len; ++i) {
            var node = items[i];
            if (node.namespace == cfg.NS_W || !node.localName) {
            }
            else if (this.isProperty(node)) {
            }
            else if (node.nodeType === 1) {
                var id = node.attributes["id"];
                if (id == null) {
                    var slots = node.attributes["slots"];
                    if (slots)
                        this.createIdForNode(node);
                }
            }
        }
    }
    OLD_ADDIDS.call(this, items);
};

function run() {
    return __awaiter(this, void 0, void 0, function* () {
        // console.log(__dirname);
        //解析参数
        let args = process.argv.slice(2);
        if ("clean" === args[0]) {
            CONFIG.isClean = true;
            args = args.slice(1);
        }
        if ("-i" === args[0]) {
            CONFIG.isIncrementalCompile = true;
            args = args.slice(1);
        }
        //配置egret项目目录
        let projectDir = path.resolve(args[0]);
        if (!file.exists(projectDir)) {
            projectDir = path.resolve(CONFIG.getDir(), args[0]);
        }
        CONFIG.setProjectDir(projectDir);
        args = args.slice(1);
        //配置游戏发布目录
        let releaseDir = args[0];
        if (!file.exists((releaseDir = path.join(CONFIG.getProjectDir(), releaseDir)))) {
            releaseDir = path.resolve(args[0]);
        }
        CONFIG.setReleaseDir(releaseDir);
        args = args.slice(1);
        //配置输出目录(可选)
        if ("-out" == args[0]) {
            CONFIG.isOutDirSet = true;
            args = args.slice(1);
            if (args[0]) {
                let outDir = path.resolve(args[0]);
                CONFIG.setOutDir(outDir);
                args = args.slice(1);
            }
        }
        //是否使用同一份配置
        if ("--fixedConfig" == args[0]) {
            CONFIG.isFixedConfig = true;
            args = args.slice(1);
        }
        //自定义配置
        if ("-cfg" == args[0]) {
            args = args.slice(1);
            if (args[0]) {
                CONFIG.setConfigDir(args[0]);
            }
        }
        //配置config(或动态解析)
        if (!CONFIG.isClean && !CONFIG.get()) {
            let fixedConfigPath = path.join(CONFIG.getProjectDir(), ".euiboostercfg");
            if (CONFIG.isFixedConfig) {
                //指定了自定义配置
                if (CONFIG.getConfigDir()) {
                    CONFIG.set(CONFIG.getConfigDir());
                }
                else {
                    //未指定自定义配置
                    if (file.exists(fixedConfigPath)) {
                        CONFIG.set(fixedConfigPath);
                    }
                    else {
                        let config = yield exml_service.run(CONFIG.getProjectDir());
                        console.log(`config generated!`);
                        CONFIG.set(config);
                        config['lasttime'] = new Date().toLocaleString();
                        file.save(fixedConfigPath, JSON.stringify(config, null, 4));
                    }
                }
            }
            else {
                //指定了自定义配置
                if (CONFIG.getConfigDir()) {
                    CONFIG.set(CONFIG.getConfigDir());
                }
                else {
                    if (file.exists(fixedConfigPath)) {
                        file.remove(fixedConfigPath);
                    }
                    let config = yield exml_service.run(CONFIG.getProjectDir());
                    console.log(`config generated!`);
                    //测试用
                    // let date:Date = new Date();
                    // configFilePath = path.resolve(CONFIG.getDir(),`test/config_gen_${date.toDateString()}.json`);
                    // file.save(configFilePath,JSON.stringify(config,null,4));
                    // console.log(`Config file generated!Save to ${configFilePath}`);
                    CONFIG.set(config);
                    config['lasttime'] = new Date().toLocaleString();
                    file.save(fixedConfigPath, JSON.stringify(config, null, 4));
                }
            }
        }
        // let content = file.read(inputFilePath);
        // var returnObj  = xml.parse(content);
        let themes = themeParser.read();
        if (themes && themes.length > 0) {
            let ishandled = false;
            themes.forEach(theme => {
                //判断类型 支持将开发目录和发布目录设置为相同的情况(定制化需求)
                if (typeof theme.exmls[0] == "string") {
                    theme.exmls = theme.exmls.map(exmlItemPath => {
                        return {
                            path: exmlItemPath,
                            content: file.read(path.resolve(CONFIG.getProjectDir(), exmlItemPath))
                        };
                    });
                }
                theme.exmls.forEach((exmlItem) => {
                    // let exmlItem = theme.exmls[i];
                    // var xmlString = file.read(exmlItem.content);
                    //增量编译
                    if (CONFIG.isIncrementalCompile &&
                        !crcFilter.crcSyncFilter(exmlItem)) {
                        return;
                    }
                    if (CONFIG.isClean) {
                        delete exmlItem.gjs;
                        delete exmlItem.className;
                        //恢复exmlItem.content
                        if (!exmlItem.content) {
                            exmlItem.content = file.read(path.resolve(CONFIG.getProjectDir(), exmlItem.path));
                        }
                        ishandled = true;
                    }
                    else {
                        console.log("parsing:", exmlItem.path);
                        if (!exmlItem.content) {
                            exmlItem.content = file.read(path.resolve(CONFIG.getProjectDir(), exmlItem.path));
                        }
                        exmlItem.gjs = parser.parse(exmlItem.content);
                        //测试用
                        // if(
                        //     // exmlItem.path.indexOf("TPanel.exml")!==-1 ||
                        //     exmlItem.path.indexOf("SendToDesktopAlertSkin.exml")!==-1
                        // ){
                        //     console.log(exmlItem.gjs);
                        // }
                        exmlItem.className = parser.className;
                        delete exmlItem.content;
                        ishandled = true;
                    }
                });
                // for(let i=0;i<theme.exmls.length;i++){
                //
                // }
            });
            //同步保存crc32摘要
            if (CONFIG.isIncrementalCompile) {
                crcFilter.save();
            }
            //将结果保存到磁盘
            CONFIG.isOutDirSet ?
                themeParser.save(CONFIG.getOutDir()) :
                themeParser.save();
            if (ishandled) {
                console.log("Done!");
            }
        }
        // let inputFilePath = process.argv[2];
        // if(!file.exists(inputFilePath)){
        //     inputFilePath = path.resolve(CONFIG.getDir(),inputFilePath);
        // }
        // console.log(inputFilePath);
        // var xmlString = file.read(inputFilePath);
        // return {
        //     text: parser.parse(xmlString),
        //     className: parser.className
        // };
    });
}
exports.run = run;
// run();
run().catch(error => console.log(error));
//# sourceMappingURL=../sourcemap/index.js.map