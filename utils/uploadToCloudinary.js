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