"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const events_1 = require("events");
const fs_1 = require("fs");
const utility_1 = require("../utility");
const options_1 = require("./options");
const timeout_1 = require("./timeout");
const ms_prettify_1 = require("ms-prettify");
const args_1 = require("./args");
class Handler extends events_1.EventEmitter {
    constructor(client, options) {
        super();
        this.Utils = utility_1.default;
        this.client = client;
        this.client.commands = new discord_js_1.Collection();
        this.client.commandAliases = new discord_js_1.Collection();
        this.options = new options_1.default(options);
        this.Timeout = new timeout_1.default(this.client, this.options.mongoURI);
        this.client.commands = new discord_js_1.Collection();
        this.client.commandAliases = new discord_js_1.Collection();
        if ((0, fs_1.existsSync)(this.options.eventFolder))
            this.handleEvents();
        this.setCommands().then(() => {
            this.emit("commandsCreated", this.client.commands, this.client.commandAliases);
            if (this.options.handleSlash)
                this.handleSlashCommands();
            if (this.options.handleNormal)
                this.handleNormalCommands();
        });
    }
    setCommands() {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                let Commands = (_a = (0, fs_1.readdirSync)(this.options.commandFolder)) === null || _a === void 0 ? void 0 : _a.filter(file => this.options.commandType === "file" ? file.endsWith(".ts") || file.endsWith(".js") : (0, fs_1.statSync)(`${this.options.commandFolder}/${file}`).isDirectory()), i;
                if (Commands.length === 0)
                    return reject("No Folders/file in the provided location");
                if (this.options.commandType === "file")
                    yield this.Utils.add.bind(this)(Commands);
                else
                    for (let i = 0; i < Commands.length; i++)
                        yield this.Utils.add.bind(this)((0, fs_1.readdirSync)(`${this.options.commandFolder}/${Commands[i]}`).filter(file => file.endsWith(".ts") || file.endsWith(".js")), `/${Commands[i]}`);
                const commandsGuild = this.client.commands.filter(v => v.guildOnly).map(v => {
                    return {
                        name: v.name,
                        description: v.description,
                        type: this.Utils.fixType(v.type),
                        // @ts-ignore
                        options: this.Utils.fixType(v.type) === 1 ? v.options.toJSON ? v.options.toJSON() : v.options : undefined
                    };
                });
                const commandsGlobal = this.client.commands.filter(v => !v.guildOnly).map(v => {
                    var _a;
                    return {
                        name: v.name,
                        description: v.description,
                        type: this.Utils.fixType(v.type),
                        // @ts-ignore
                        options: this.Utils.fixType(v.type) === 1 ? ((_a = v.options) === null || _a === void 0 ? void 0 : _a.toJSON) ? v.options.toJSON() : v.options : undefined
                    };
                });
                if (this.client.isReady() === true) {
                    this.client.application.commands.set(commandsGlobal);
                    this.options.slashGuilds.forEach(v => this.client.application.commands.set(commandsGuild, v));
                }
                else {
                    this.client.once('ready', () => {
                        this.client.application.commands.set(commandsGlobal);
                        if (Array.isArray(this.options.slashGuilds)) {
                            this.options.slashGuilds.forEach(v => this.client.application.commands.set(commandsGlobal, v));
                        }
                        else {
                            this.client.application.commands.set(commandsGlobal, this.options.slashGuilds);
                        }
                    });
                }
                resolve({ commands: this.client.commands, commandAliases: this.client.commandAliases });
            }
            catch (e) {
                reject(e);
            }
        }));
    }
    handleSlashCommands() {
        return __awaiter(this, void 0, void 0, function* () {
            this.client.on("interactionCreate", (interaction) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                if (!interaction.isCommand() && !interaction.isContextMenu())
                    return;
                const command = this.client.commands.get(interaction.commandName), member = interaction.guild.members.cache.get(interaction.user.id);
                if (this.options.autoDefer === true)
                    yield interaction.deferReply();
                try {
                    if (command.dm !== true && !interaction.guild) {
                        if (typeof command.error === "function")
                            command.error("guildOnly", command, interaction);
                        else if (this.listeners("guildOnly").length > 0)
                            this.emit("guildOnly", command, interaction);
                        else
                            this.Utils.replyInteraction(interaction, this.options.guildOnlyReply.replace(/{mention}/g, interaction.user.toString()).replace(/{command}/g, command.name));
                        return;
                    }
                    if (command.dm === "only" && interaction.guild) {
                        if (typeof command.error === "function")
                            command.error("dmOnly", command, interaction);
                        else if (this.listeners("dmOnly").length > 0)
                            this.emit("dmOnly", command, interaction);
                        else
                            this.Utils.replyInteraction(interaction, this.options.dmOnlyReply.replace(/{mention}/g, interaction.user.toString()).replace(/{command}/g, command.name));
                        return;
                    }
                    if (command.ownerOnly && !this.options.owners.includes(interaction.user.id)) {
                        if (typeof command.error === "function")
                            command.error("notOwner", command, interaction);
                        else if (this.listeners("notOwner").length > 0)
                            this.emit("notOwner", command, interaction);
                        else
                            this.Utils.replyInteraction(interaction, this.options.notOwnerReply.replace(/{mention}/g, interaction.user.toString()));
                        return;
                    }
                    const tm = yield this.Timeout.getTimeout(interaction.user.id, interaction.commandName);
                    if (tm.from > Date.now()) {
                        if (typeof command.error === "function")
                            command.error("timeout", command, interaction, tm.from - Date.now());
                        else if (this.listeners("timeout").length > 0)
                            this.emit("timeout", command, interaction, tm.from - Date.now());
                        else
                            this.Utils.replyInteraction(interaction, this.options.timeoutMessage.replace(/{remaining}/g, (0, ms_prettify_1.default)(tm.from - Date.now())).replace(/{mention}/g, interaction.user.toString()).replace(/{command}/g, command.name));
                        return;
                    }
                    const args = new args_1.default([...(_a = interaction === null || interaction === void 0 ? void 0 : interaction.options) === null || _a === void 0 ? void 0 : _a.data] || []);
                    const values = {
                        1: this.client,
                        2: interaction.guild,
                        3: interaction.channel,
                        4: interaction,
                        5: args,
                        6: interaction.member,
                        7: interaction.member.user,
                        8: interaction,
                        9: this,
                    }, keys = {
                        1: "client",
                        2: "guild",
                        3: "channel",
                        4: "interaction",
                        5: "args",
                        6: "member",
                        7: "user",
                        8: "message",
                        9: "handler"
                    };
                    const parameters = this.Utils.getParameters(keys, values, this.options.runParameters);
                    let allow = command.permissions ? command.permissions.length === 0 : true;
                    // @ts-ignore
                    if (command.permissions)
                        command.permissions.forEach((v) => { if (member.permissions.has(v))
                            allow = true; });
                    if (!allow) {
                        if (typeof command.error === "function")
                            command.error("noPermissions", command, interaction);
                        else if (this.listeners("noPermissions").length > 0)
                            this.emit("noPermissions", command, interaction);
                        else
                            this.Utils.replyInteraction(interaction, this.options.permissionReply.replace(/{mention}/g, interaction.user.toString()).replace(/{command}/g, command.name));
                        return;
                    }
                    let timeout;
                    if (command.timeout) {
                        if (typeof command.timeout === "string")
                            timeout = (0, ms_prettify_1.default)(command.timeout);
                        else
                            timeout = command.timeout;
                    }
                    if (timeout && this.options.timeout === true)
                        this.Timeout.setTimeout(interaction.user.id, command.name, Date.now() + timeout);
                    if (this.options.handleSlash === true)
                        command.run(...parameters);
                    else
                        this.emit("slashCommand", command, ...parameters);
                }
                catch (e) {
                    if (typeof command.error === "function")
                        command.error("exception", command, interaction, e);
                    else if (this.listeners("exception").length > 0)
                        this.emit("exception", command, interaction, e);
                    else
                        this.Utils.replyInteraction(interaction, this.options.errorReply);
                }
            }));
        });
    }
    handleNormalCommands() {
        return __awaiter(this, void 0, void 0, function* () {
            this.client.on('messageCreate', (message) => __awaiter(this, void 0, void 0, function* () {
                let command;
                try {
                    if (message.author.bot || !message.content.toLowerCase().startsWith(this.options.prefix))
                        return;
                    const args = message.content.slice(this.options.prefix.length).trim().split(/ +/g) || [];
                    let cmd = args.shift().toLowerCase();
                    if (cmd.length == 0)
                        return;
                    command = this.client.commands.get(cmd) || this.client.commands.get(this.client.commandAliases.get(cmd));
                    if ((command === null || command === void 0 ? void 0 : command.slash) === true)
                        return;
                    if (command.ownerOnly && !this.options.owners.includes(message.author.id)) {
                        if (typeof command.error === "function")
                            command.error("notOwner", command, message);
                        else if (this.listeners("notOwner").length > 0)
                            this.emit("notOwner", command, message);
                        else
                            message.reply(this.options.notOwnerReply.replace(/{mention}/g, message.author.toString()));
                        return;
                    }
                    if (command.dm !== true && !message.guild) {
                        if (typeof command.error === "function")
                            command.error("guildOnly", command, message);
                        else if (this.listeners("guildOnly").length > 0)
                            this.emit("guildOnly", command, message);
                        else
                            message.reply(this.options.guildOnlyReply.replace(/{mention}/g, message.author.toString()).replace(/{command}/g, command.name));
                        return;
                    }
                    if (command.dm === "only" && message.guild) {
                        if (typeof command.error === "function")
                            command.error("dmOnly", command, message);
                        else if (this.listeners("dmOnly").length > 0)
                            this.emit("dmOnly", command, message);
                        else
                            message.reply(this.options.dmOnlyReply.replace(/{mention}/g, message.author.toString()).replace(/{command}/g, command.name));
                        return;
                    }
                    const tm = yield this.Timeout.getTimeout(message.author.id, command.name);
                    if (tm.from > Date.now()) {
                        if (typeof command.error === "function")
                            command.error("timeout", command, message, tm.from - Date.now());
                        else if (this.listeners("timeout").length > 0)
                            this.emit("timeout", command, message, tm.from - Date.now());
                        else
                            message.reply(this.options.timeoutMessage.replace(/{mention}/g, message.author.toString()).replace(/{remaining}/g, (0, ms_prettify_1.default)(tm.from - Date.now())).replace(/{command}/g, command.name));
                        return;
                    }
                    const reqArgs = command.args ? this.Utils.getOptions(command.args).filter((v) => v.required === true) || [] : command.options ? command.options.filter(v => v.required === true) : [];
                    0;
                    if (args.length < reqArgs.length) {
                        let args = command.args || "";
                        if (args === "" && command.options.length > 0)
                            command.options.forEach(v => args += v.required ? `<${v.name}>` : `[${v.name}]`);
                        if (typeof command.error === "function")
                            command.error("lessArguments", command, message);
                        else if (this.listeners("lessArguments").length > 0)
                            this.emit("lessArguments", command, message);
                        else
                            message.reply({ content: `Invalid Syntax corrected syntax is : \`${this.options.prefix}${command.name} ${args}\`` });
                        return;
                    }
                    let allow = command.permissions && message.guild ? command.permissions.length === 0 : true;
                    // @ts-ignore
                    if (message.guild)
                        if (command.permissions)
                            command.permissions.forEach((v) => { if (message.member.permissions.has(v))
                                allow = true; });
                    if (!allow) {
                        if (typeof command.error === "function")
                            command.error("noPermissions", command, message);
                        else if (this.listeners("noPermissions").length > 0)
                            this.emit("noPermissions", command, message);
                        else
                            message.reply(this.options.permissionReply.replace(/{mention}/g, message.author.toString()).replace(/{command}/g, command.name));
                        return;
                    }
                    const command_data = {
                        client: this.client,
                        guild: message.guild,
                        channel: message.channel,
                        interaction: undefined,
                        args: new args_1.default(args),
                        member: message.member,
                        message: message,
                        handler: this,
                        user: message.author
                    };
                    let timeout;
                    if (command.timeout) {
                        if (typeof command.timeout === "string")
                            timeout = (0, ms_prettify_1.default)(command.timeout);
                        else
                            timeout = command.timeout;
                    }
                    if (timeout && this.options.timeout === true) {
                        this.Timeout.setTimeout(message.author.id, command.name, Date.now() + timeout);
                    }
                    if (this.options.handleNormal === true)
                        command.run(command_data);
                    else
                        this.emit("normalCommand", command, command_data);
                }
                catch (e) {
                    if (typeof command.error === "function")
                        command.error("exception", command, message, e);
                    else if (this.listeners("exception").length > 0)
                        this.emit("exception", command, message, e);
                    else
                        message.reply(this.options.errorReply);
                }
            }));
        });
    }
    handleEvents() {
        return __awaiter(this, void 0, void 0, function* () {
            (0, fs_1.readdirSync)(this.options.eventFolder).filter((f) => f.endsWith(".js")).forEach((file) => {
                this.client.on(`${file.split(".")[0]}`, (...args) => require(`${this.options.eventFolder}/${file}`)(this.client, ...args));
            });
        });
    }
    reloadCommands() {
        return __awaiter(this, void 0, void 0, function* () {
            this.client.commands.clear();
            this.client.commandAliases.clear();
            return new Promise((res, rej) => {
                this.setCommands()
                    .then((v) => {
                    res({ commands: this.client.commands, aliases: this.client.commandAliases });
                    console.log("[ discord-slash-command-handler ] : Commands are reloaded");
                    this.emit("commandsCreated", this.client.commands, this.client.commandAliases);
                })
                    .catch((e) => {
                    rej(e);
                    console.log("[ discord-slash-command-handler ] : There was a error in reloading the commands");
                    console.log(e);
                });
            });
        });
    }
    on(eventName, listener) {
        return super.on(eventName, listener);
    }
}
exports.default = Handler;
