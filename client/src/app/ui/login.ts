import { SessionStartResponse } from "@common/serverApi";
import * as ServerApi from "../serverApi";

export function createLoginPrompt(callback: (response: SessionStartResponse) => void) {
    const root = document.createElement("div");
    root.classList.add("login");

    const fieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = "Login";

    fieldset.append(legend);

    const form = document.createElement("form");
    form.addEventListener("submit", async event => {
        event.preventDefault();
        
        const username = usernameField.value;
        const password = passwordField.value;

        try {
            const response = await ServerApi.login({ username, password });

            callback(response);
        } catch(e) {
            console.error(e);
        }
    });


    const usernameContainer = document.createElement("div");
    usernameContainer.classList.add("username");

    const usernameLabel = document.createElement("span");
    usernameLabel.textContent = "Username";
    const usernameField = document.createElement("input");
    usernameField.type = "text";

    usernameContainer.append(usernameLabel, usernameField);


    const passwordContainer = document.createElement("div");
    passwordContainer.classList.add("password");

    const passwordLabel = document.createElement("span");
    passwordLabel.textContent = "Password";
    const passwordField = document.createElement("input");
    passwordField.type = "password";

    passwordContainer.append(passwordLabel, passwordField);


    const submitButton = document.createElement("input");
    submitButton.type = "submit";
    submitButton.value = "Login";


    form.append(usernameContainer, passwordContainer, submitButton);
    fieldset.append(form);
    root.append(fieldset);

    return root;
}

export function createRegisterPrompt(callback: (response: SessionStartResponse) => void) {
    const root = document.createElement("div");
    root.classList.add("register");

    const fieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = "Register";

    fieldset.append(legend);

    const form = document.createElement("form");
    form.addEventListener("submit", async event => {
        event.preventDefault();
        
        const username = usernameField.value;
        const password = passwordField.value;
        const passwordConfirm = passwordConfirmField.value;

        try {
            if(password != passwordConfirm) throw new Error("Passwords do not match");

            const response = await ServerApi.register({ username, password });

            callback(response);
        } catch(e) {
            console.error(e);
        }
    });


    const usernameContainer = document.createElement("div");
    usernameContainer.classList.add("username");

    const usernameLabel = document.createElement("span");
    usernameLabel.textContent = "Username";
    const usernameField = document.createElement("input");
    usernameField.type = "text";

    usernameContainer.append(usernameLabel, usernameField);


    const passwordContainer = document.createElement("div");
    passwordContainer.classList.add("password");

    const passwordLabel = document.createElement("span");
    passwordLabel.textContent = "Password";
    const passwordField = document.createElement("input");
    passwordField.type = "password";

    passwordContainer.append(passwordLabel, passwordField);


    const passwordConfirmContainer = document.createElement("div");
    passwordConfirmContainer.classList.add("passwordConfirm");

    const passwordConfirmLabel = document.createElement("span");
    passwordConfirmLabel.textContent = "Confirm Password";
    const passwordConfirmField = document.createElement("input");
    passwordConfirmField.type = "password";

    passwordConfirmContainer.append(passwordConfirmLabel, passwordConfirmField);


    const submitButton = document.createElement("input");
    submitButton.type = "submit";
    submitButton.value = "Register";


    form.append(usernameContainer, passwordContainer, passwordConfirmContainer, submitButton);
    fieldset.append(form);
    root.append(fieldset);

    return root;
}