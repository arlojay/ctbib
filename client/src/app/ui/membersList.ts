import { TypedEmitter } from "tiny-typed-emitter";
import { ServerMemberJson } from "@common/serverApi";

export class MemberListEvents extends TypedEmitter<{
    "fetch": () => void;
    "load": (members: ServerMemberJson[]) => void;
    "create-invite": () => void;
    "add-user": (user: ServerMemberJson) => void;
}> {}

interface MemberListOptions {
    serverOwner: string;
    canInviteUsers: boolean;
}

export function createMembersListScreen(events: MemberListEvents, options: MemberListOptions) {
    const root = document.createElement("div");
    root.classList.add("member-list");

    const titlebar = document.createElement("div");
    titlebar.classList.add("titlebar");

    const memberListTitle = document.createElement("span");
    memberListTitle.textContent = "Members";
    titlebar.append(memberListTitle);

    const list = document.createElement("div");
    list.classList.add("list");

    const memberElements: Map<string, HTMLDivElement> = new Map;
    const memberMap: Map<string, ServerMemberJson> = new Map;

    function findAlphabeticallySucceedingMember(member: ServerMemberJson) {
        let closestValue = Infinity;
        let closestMember: ServerMemberJson = null;
        const matchingChars: string[] = new Array;

        outer:for(const otherMember of memberMap.values()) {
            for(let i = 0; i < matchingChars.length; i++) {
                if(otherMember.username[i] != matchingChars[i]) continue outer;
            }

            const char = member.username[matchingChars.length];
            const otherChar = otherMember.username[matchingChars.length];
            if(otherChar.charCodeAt(0) < closestValue && otherChar.charCodeAt(0) > char.charCodeAt(0)) {
                closestValue = otherChar.charCodeAt(0);

                if(char == otherChar) {
                    matchingChars.push(char);
                }

                closestMember = otherMember;
            }
        }

        return closestMember;
    }

    function createMemberCard(member: ServerMemberJson) {
        const card = document.createElement("div");
        card.classList.add("member");
        
        const memberName = document.createElement("span");
        memberName.classList.add("name");
        memberName.textContent = member.username;

        card.append(memberName);
        list.append(card);

        if(member.uuid == options.serverOwner) {
            card.classList.add("owner");
            card.title = "Owner";
        }
        
        memberMap.set(member.uuid, member);
        memberElements.set(member.uuid, card);

        return card;
    }

    function addMember(member: ServerMemberJson) {
        const succeedingMember = findAlphabeticallySucceedingMember(member);
        const card = createMemberCard(member);
        
        if(succeedingMember == null) {
            list.append(card);
        } else {
            const suceedingElement = memberElements.get(succeedingMember.uuid);
            suceedingElement.insertAdjacentElement("beforebegin", card);
        }
    }

    events.on("load", members => {
        for(const member of members) {
            addMember(member);
        }
    });
    events.on("add-user", addMember);


    const actions = document.createElement("div");
    actions.classList.add("actions");    

    if(options.canInviteUsers) {
        const createChannelButton = document.createElement("button");
        createChannelButton.textContent = "Create Invite";

        createChannelButton.addEventListener("click", () => {
            events.emit("create-invite");
        });

        actions.append(createChannelButton);
    }

    root.append(titlebar, list, actions);

    events.emit("fetch");

    return root;
}