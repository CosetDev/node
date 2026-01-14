import { HexAddress, NetworkKeys } from "../lib/types";
import mongoose, { Schema, type Model, type Document, Types } from "mongoose";

export interface IOracle {
    name: string;
    description: string;
    verifications: {
        api: boolean;
        signature: HexAddress | null;
    };
    api: {
        protocol: "https" | "wss";
        url: string;
        accessToken?: string;
    };
    provider: HexAddress;
    network: NetworkKeys;
    address: HexAddress;
    requestPrice: number;
    recommendedUpdateDuration?: number;
}

export interface IOracleDocument extends IOracle, Document {
    _id: Types.ObjectId;
    createdAt: Date;
}

const OracleSchema = new Schema<IOracleDocument>(
    {
        name: { type: String, required: true },
        description: { type: String, required: true },
        verifications: {
            api: { type: Boolean, required: true },
            signature: { type: String, default: null },
        },
        api: {
            protocol: { type: String, enum: ["https", "wss"], required: true },
            url: { type: String, required: true },
        },
        provider: { type: String, required: true },
        network: { type: String, required: true },
        address: { type: String, required: true, unique: true },
        requestPrice: { type: Number, required: true },
        recommendedUpdateDuration: { type: Number },
        createdAt: { type: Date, default: Date.now },
    },
    { versionKey: false },
);

export const Oracle: Model<IOracleDocument> =
    mongoose.models.Oracle || mongoose.model<IOracleDocument>("Oracle", OracleSchema);

export default Oracle;
