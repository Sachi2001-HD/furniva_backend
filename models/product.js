import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    material: {
      type: String,
      required: true,
      trim: true,
    },

    colour: {
      type: String,
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    offerPrice: {
      type: Number,
      min: 0,
      default: null,
    },

    // All dimensions in cm
    dimensions: {
      w: { type: Number, required: true, min: 1 },
      d: { type: Number, required: true, min: 1 },
      h: { type: Number, required: true, min: 1 },
    },

    images: {
      type: [String],
      validate: {
        validator: (value) => value.length > 0,
        message: "Add at least one product image",
      },
    },

    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    badge: {
      type: String,
      enum: ["Bestseller", "New", null],
      default: null,
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },

    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },

    reviewCount: {
      type: Number,
      min: 0,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

productSchema.pre("validate", function () {
  if (this.offerPrice != null && this.offerPrice >= this.price) {
    this.invalidate(
      "offerPrice",
      "Offer price must be lower than the regular price"
    );
  }
});

productSchema.virtual("inStock").get(function () {
  return this.stock > 0;
});

// Search and filtering
productSchema.index({ name: "text", description: "text", material: "text" });
productSchema.index({ category: 1, isActive: 1 });

const Product = mongoose.model("Product", productSchema);

export default Product;