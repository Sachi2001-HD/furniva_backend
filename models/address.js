import mongoose from "mongoose";

export const ADDRESS_LABELS = ["Home", "Work", "Other"];

const addressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    label: { type: String, enum: ADDRESS_LABELS, default: "Home" },

    fullName: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    address: { type: String, required: true, trim: true, maxlength: 200 },
    city: { type: String, required: true, trim: true, maxlength: 80 },
    postalCode: { type: String, trim: true, maxlength: 20 },

    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Address = mongoose.model("Address", addressSchema);

export default Address;