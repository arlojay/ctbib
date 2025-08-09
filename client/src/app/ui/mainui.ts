export class MainUI {
    public root: HTMLDivElement;

    public serverList: HTMLDivElement;
    public channelList: HTMLDivElement;
    public chatScreen: HTMLDivElement;
    public loginScreen: HTMLDivElement;
    
    constructor() {
        this.root = document.createElement("div");
        this.root.classList.add("main");

        this.serverList = document.createElement("div");
        this.serverList.classList.add("server-list");

        this.channelList = document.createElement("div");
        this.channelList.classList.add("channel-list");

        this.chatScreen = document.createElement("div");
        this.chatScreen.classList.add("chat");

        this.loginScreen = document.createElement("div");
        this.loginScreen.classList.add("account");

        this.root.append(this.serverList, this.channelList, this.chatScreen, this.loginScreen);
    }
}