import mongoose, { Schema, type Document, type Model, Types } from "mongoose";

export interface IPayment {
    oracle: Types.ObjectId;
    totalPaid: number;
    providerEarning: number;
    gasFee: number;
    platformFee: number;
    currency: string;
    network: string;
}

export interface IPaymentDocument extends IPayment, Document {
    _id: Types.ObjectId;
    createdAt: Date;
}

const PaymentSchema = new Schema<IPaymentDocument>(
    {
        oracle: { type: Schema.Types.ObjectId, ref: "Oracle", required: true },
        totalPaid: { type: Number, required: true },
        providerEarning: { type: Number, required: true },
        gasFee: { type: Number, required: true },
        platformFee: { type: Number, required: true },
        currency: { type: String, required: true },
        network: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
    },
    { versionKey: false },
);

export const Payment: Model<IPaymentDocument> =
    mongoose.models.Payment || mongoose.model<IPaymentDocument>("Payment", PaymentSchema);
export default Payment;
