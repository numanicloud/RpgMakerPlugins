/*:ja
 * @target MZ
 * @plugindesc マップイベント内のイベントの一部を、他の場所から呼び出せるようにします。
 * @author NumAniCloud
 * 
 * @help ContextEvent.js
 * 【概要】
 * マップイベントに書いたイベントの一部を「文脈イベント」を定義し、
 * そのマップイベント内や、マップイベントから呼ばれたコモンイベントから
 * 呼び出せるようにするプラグインです。
 * 
 * 「コモンイベント」「マップイベント」に強く関係しています。
 * 
 * 【使い道】
 * 例えば、BGMをイベントで流さねばならない条件下で、
 * 2つの場所移動イベントを作ることを考えます。
 * 
 * どちらのイベントも、開始時と終了時の処理が同じとします：
 *   - (開始)
 *   - BGMをフェードアウトする。
 *   - 画面をフェードアウト。
 *   - ウェイトを挟んでBGMのフェードアウトを待つ。
 *   - **フェード無しで場所移動をする**(ここだけ、イベントごとに違う)。
 *   - BGMを流す。
 *   - 画面をフェードインする。
 *   - (終了)
 * 
 * このように処理が似通っているときはコモンイベントを利用したくなりますが、
 * **フェード無しで場所移動をする** の部分がイベントごとに異なります。
 * 処理の途中部分が異なる場合、コモンイベントを利用するには工夫が必要です。
 * 
 * この「文脈イベント」プラグインは、コモンイベントに関する工夫のひとつです。
 * イベントごとに、コモンイベントの途中の処理を変更するために利用できます。
 * 
 * 【詳細解説】
 * このプラグインの機能は、3つのプラグインコマンドを使うことで成立します。
 * 1. 文脈イベントの定義
 * 2. 文脈イベントの定義の終端
 * 3. 文脈イベントを呼び出す
 * 
 * ## プラグインコマンドの使い方
 * プラグインコマンド「《文脈イベントの定義」と「文脈イベントの定義の終端》」で
 * 挟まれたイベントの列が文脈イベントとしてプラグインに設定されます。
 * プラグインコマンド「文脈イベントを呼び出す」を使うことで、
 * 設定されている文脈イベントを実行することができます。
 * 
 * 文脈イベントは識別子を持ち、定義するときに指定した識別子と
 * 同じ識別子で呼び出すことにより、文脈イベントどうしを区別します。
 * 
 * ## 文脈イベントが無効になるタイミング
 * 文脈イベントを定義したマップイベントからコモンイベントを呼び出すと、
 * そのコモンイベントの中でも文脈イベントは設定されたままで、使用可能です。
 * そのコモンイベントから更にコモンイベントを呼んでも同様です。
 * 
 * 一方、マップイベントが完了すると文脈イベントは忘れ去られるため、
 * 同じ識別子の文脈イベントをマップイベントごとに異なる内容で設定することができます。
 * 
 * @command OpenDefinition
 * @text 《文脈イベントの定義
 * @desc 文脈イベントの定義の始まりとなるラベルです。前方の文脈イベント定義に対する終端としても働きます。
 * @arg name
 * @type string
 * @text 識別子
 * @desc 「文脈イベントを呼び出す」で使用する名前です。
 * 
 * @command CloseDefinition
 * @text 文脈イベントの定義の終端》
 * @desc 文脈イベントの定義の終わりとなるラベルです。
 * 
 * @command Call
 * @text 文脈イベントを呼び出す
 * @desc 文脈イベントを呼び出します。
 * @arg name
 * @type string
 * @text 識別子
 * @desc 呼び出す文脈イベントの名前です。
 */

class Plugin {
    private pluginId = "ContextEvent";
    private repository = new EventRepository();
    private installer;
    private invoker;

    constructor() {
        this.installer = new ContextInstaller(this.pluginId, this.repository);
        this.invoker = new ContextInvoker(this.repository);
    }

    initialize() {
        this.registerPluginCommand(
            "OpenDefinition",
            (self, args) => this.installer.install(self, args));
        this.registerPluginCommand(
            "Call",
            (self, args) => this.invoker.invoke(self, args));
        this.registerPluginCommand("CloseDefinition", _ => {});
        Plugin.alternatePrototype(this.repository);
    }

    registerPluginCommand(name: string,
        func: (self: Game_Interpreter, args: any) => void) {
        PluginManager.registerCommand(this.pluginId, name, function (this: Game_Interpreter, ps: any) {
            func(this, ps);
        });
    }

    static alternatePrototype(repo: EventRepository) {
        const terminate_base = Game_Interpreter.prototype.terminate;
        Game_Interpreter.prototype.terminate = function() {
            terminate_base.apply(this, arguments as any);
            repo.resetTable(this);
        }
    }
}

declare var console: {
    info(message: string): void;
}

class EventTable {
    private tables: Map<string, rm.types.EventCommand[]> = new Map();

    getEvents(name: string): rm.types.EventCommand[] | undefined {
        return this.tables.get(name);
    }
    setEvents(name: string, list: rm.types.EventCommand[]) {
        this.tables.set(name, list);
    }
}

class EventRepository {
    private tables: Map<number, EventTable> = new Map();

    getTable(interpreter: Game_Interpreter): EventTable {
        let table = this.tables.get(interpreter._depth);
        if (table === undefined) {
            table = new EventTable();
            this.tables.set(interpreter._depth, table);
        }
        return table;
    }

    resetTable(interpreter: Game_Interpreter) {
        this.tables.delete(interpreter._depth);
    }

    getContextEvent(name: string): rm.types.EventCommand[] | undefined {
        let result: rm.types.EventCommand[] | undefined;
        this.tables.forEach((v, k, m) => {
            result = v.getEvents(name);
        });
        return result;
    }
}

class Mutex {
    private isLocked = false;

    enter() {
        if (this.isLocked) {
            throw new Error(`Entering locked section.`);
        }
        this.isLocked = true;
    }

    exit() {
        this.isLocked = false;
    }
}

class ContextInstaller {
    constructor(
        private pluginId: string,
        private repository: EventRepository,
        private commandRows: number = 1)
    {
        console.info("constructor of ContextInstaller");
    }

    install(interpreter: Game_Interpreter, args: any): void {
        const list = interpreter._list;
    
        const programCounter = interpreter._index;
        const openedPos = programCounter + this.commandRows + 1;
        const closingPos = openedPos + this.countContextsAhead(list, openedPos);
    
        const behind = list.slice(0, programCounter);
        const range = list.slice(openedPos, closingPos);
        const ahead = list.slice(closingPos);
    
        this.repository.getTable(interpreter).setEvents(args["name"], range);
        interpreter._list = behind.concat(ahead);
        interpreter._index -= 1;   // このプラグインコマンド呼び出しは消えるのでプログラムカウンタを進めない
    }

    countContextsAhead(list: rm.types.EventCommand[], start: number): number {
        let count = 0;
        while (start + count < list.length) {
            const event = list[start + count];
            if (this.isClosingCommand(event)) break;

            ++count;
        }
        return count;
    }
    
    isClosingCommand(event: rm.types.EventCommand) {
        return event.code == 357
            && event.parameters[0] == this.pluginId
            && (event.parameters[1] == "OpenDefinition"
                || event.parameters[1] == "CloseDefinition");
    }
}

class ContextInvoker {
    private commandRows = 1;
    private mutex = new Mutex();

    constructor(private repository: EventRepository) { }

    invoke(interpreter: Game_Interpreter, args: any) {
        this.mutex.enter();

        const insert = this.repository.getContextEvent(args["name"]);
        if (!insert) return;

        const list = interpreter._list;
        
        const programCounter = interpreter._index;
        const callingPos = programCounter + this.commandRows + 1;
        
        const behind = list.slice(0, programCounter);
        const ahead = list.slice(callingPos);
    
        interpreter._list = behind.concat(insert).concat(ahead);
        interpreter._index -= 1;   // このプラグインコマンド呼び出しは消えるのでプログラムカウンタを進めない

        this.mutex.exit();
    }
}

var plugin = new Plugin();
plugin.initialize();