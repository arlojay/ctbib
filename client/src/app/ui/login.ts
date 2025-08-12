import { SessionStartResponse } from "@common/serverApi";
import * as ServerApi from "../serverApi";
import { validatePassword, validateUsername } from "@common/validation";

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
            passwordError.textContent = "";
            const response = await ServerApi.login({ username, password });

            callback(response);
        } catch(e) {
            let baseError = e;
            while(baseError.cause != null) baseError = baseError.cause;

            if(baseError instanceof ServerApi.ServerError && baseError.type == "response") {
                passwordError.textContent = baseError.message;
            } else {
                console.error(e);
            }
        }
    });


    const usernameContainer = document.createElement("div");
    usernameContainer.classList.add("username");

    const usernameLabel = document.createElement("span");
    usernameLabel.textContent = "Username";
    const usernameField = document.createElement("input");
    usernameField.type = "text";
    usernameField.autocomplete = "username";

    usernameContainer.append(usernameLabel, usernameField);


    const passwordContainer = document.createElement("div");
    passwordContainer.classList.add("password");

    const passwordLabel = document.createElement("span");
    passwordLabel.textContent = "Password";
    const passwordField = document.createElement("input");
    passwordField.type = "password";
    passwordField.autocomplete = "current-password";

    const passwordError = document.createElement("span");
    passwordError.classList.add("error");

    passwordContainer.append(passwordLabel, passwordField, passwordError);


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
            usernameError.textContent = "";

            callback(response);
        } catch(e) {
            let baseError = e;
            while(baseError.cause != null) baseError = baseError.cause;

            if(baseError instanceof ServerApi.ServerError && baseError.type == "response") {
                usernameError.textContent = baseError.message;
            } else {
                console.error(e);
            }
        }
    });


    const usernameContainer = document.createElement("div");
    usernameContainer.classList.add("username");

    const usernameLabel = document.createElement("span");
    usernameLabel.textContent = "Username";
    const usernameField = document.createElement("input");
    usernameField.type = "text";
    usernameField.autocomplete = "username";

    usernameField.addEventListener("input", () => {
        try {
            validateUsername(usernameField.value);
            usernameError.textContent = "";
        } catch(e) {
            usernameError.textContent = e;
        }
    })

    const usernameError = document.createElement("span");
    usernameError.classList.add("error");

    usernameContainer.append(usernameLabel, usernameField, usernameError);


    const passwordContainer = document.createElement("div");
    passwordContainer.classList.add("password");

    const passwordLabel = document.createElement("span");
    passwordLabel.textContent = "Password";
    const passwordField = document.createElement("input");
    passwordField.type = "password";
    passwordField.autocomplete = "new-password";

    passwordField.addEventListener("input", () => {
        try {
            validatePassword(passwordField.value);
            passwordError.textContent = "";
        } catch(e) {
            passwordError.textContent = e;
        }

        updatePasswordConfirm();
    })

    const passwordError = document.createElement("span");
    passwordError.classList.add("error");

    passwordContainer.append(passwordLabel, passwordField, passwordError);


    const passwordConfirmContainer = document.createElement("div");
    passwordConfirmContainer.classList.add("passwordConfirm");

    const passwordConfirmLabel = document.createElement("span");
    passwordConfirmLabel.textContent = "Confirm Password";
    const passwordConfirmField = document.createElement("input");
    passwordConfirmField.type = "password";
    passwordConfirmField.autocomplete = "new-password";

    passwordConfirmField.addEventListener("input", () => {
        updatePasswordConfirm();
    })

    function updatePasswordConfirm() {
        if(passwordField.value == passwordConfirmField.value) {
            passwordConfirmError.textContent = "";
        } else {
            passwordConfirmError.textContent = "Passwords do not match";
        }
    }

    const passwordConfirmError = document.createElement("span");
    passwordConfirmError.classList.add("error");

    passwordConfirmContainer.append(passwordConfirmLabel, passwordConfirmField, passwordConfirmError);


    const submitButton = document.createElement("input");
    submitButton.type = "submit";
    submitButton.value = "Register";


    form.append(usernameContainer, passwordContainer, passwordConfirmContainer, submitButton);
    fieldset.append(form);
    root.append(fieldset);

    return root;
}