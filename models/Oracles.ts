import mongoose, { Schema, type Model, type Document, Types } from "mongoose";

export interface IOracle {
    name: string;
    description: string;
    verifications: {
        api: boolean;
        signature: string | null;
    };
    api: {
        protocol: "https" | "wss";
        url: string;
    };
    owner: string;
    network?: string;
    address?: string;
    requestPrice: number;
    recommendedUpdateDuration?: number;
    deploymentTx?: string;
}

export interface IOracleDocument extends IOracle, Document {
    _id: Types.ObjectId;
    createdAt: Date;
}

const OracleSchema = new Schema<IOracleDocument>(
    {
        name: { type: String, required: true, unique: true },
        description: { type: String, required: true },
        verifications: {
            api: { type: Boolean, required: true },
            signature: { type: String, default: null },
        },
        api: {
            protocol: { type: String, enum: ["https", "wss"], required: true },
            url: { type: String, required: true },
        },
        owner: { type: String, required: true },
        network: { type: String },
        address: { type: String },
        requestPrice: { type: Number, required: true },
        recommendedUpdateDuration: { type: Number },
        deploymentTx: { type: String },
        createdAt: { type: Date, default: Date.now },
    },
    { versionKey: false },
);

export const Oracle: Model<IOracleDocument> =
    mongoose.models.Oracle || mongoose.model<IOracleDocument>("Oracle", OracleSchema);

export default Oracle;
