import { Password, SerializedPassword } from "./password";
import { ObjectId } from "mongodb";

export interface SerializedLogin {
    _id: ObjectId;
    password: SerializedPassword;
}
export class Login {
    public uuid: ObjectId;
    public password: Password = new Password;

    public create(password: string) {
        this.password.generate(password);
    }

    public setUUID(uuid: ObjectId) {
        this.uuid = uuid;
    }

    public serialize(): SerializedLogin {
        return {
            _id: this.uuid,
            password: this.password.serialize()
        }
    }
    public deserialize(data: SerializedLogin) {
        this.uuid = data._id;
        this.password.deserialize(data.password);
    }
    
    public testPassword(password: string) {
        return this.password.test(password);
    }
}