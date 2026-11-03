import cloudinary from "../config/cloudinary.js";

export const uploadToCloudinary = (buffer, folder = "furniva/products") =>
  new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          asset_folder: folder,
          use_asset_folder_as_public_id_prefix: true,
        },
        (err, result) => (err ? reject(err) : resolve(result))
      )
      .end(buffer);
  });

// 3D models 
export const uploadModelToCloudinary = (buffer, originalName = "model.glb") =>
  new Promise((resolve, reject) => {
    const base =
      originalName
        .replace(/\.glb$/i, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "model";

    cloudinary.uploader
      .upload_stream(
        {
          resource_type: "raw",
          public_id: `${Date.now()}-${base}.glb`,
          asset_folder: "furniva/models",
          use_asset_folder_as_public_id_prefix: true,
        },
        (err, result) => (err ? reject(err) : resolve(result))
      )
      .end(buffer);
  });