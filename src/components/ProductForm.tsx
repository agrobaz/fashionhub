import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import type { Condition, ListingType } from "../lib/types";
import { errorMessage } from "../lib/format";
import { resizeImage } from "../lib/image";

type Props = {
  shopId: string;
  onAdded: () => void;
};

const categories = [
  "Men",
  "Women",
  "Kids",
  "Thrift",
  "African Wear",
  "Wedding & Occasion",
  "Accessories",
];

const subcategories = [
  "Clothing",
  "Shoes",
  "Dresses",
  "Tops",
  "Shirts",
  "Trousers",
  "Jeans",
  "Skirts",
  "Jackets",
  "Suits",
  "Traditional Wear",
  "Bags",
  "Belts",
  "Jewelry",
  "Watches",
  "Sandals",
  "Heels",
  "Sneakers",
  "Boots",
  "Other",
];

const fitTypes = [
  "True to size",
  "Runs small",
  "Runs large",
  "Oversized",
  "Slim fit",
  "Regular fit",
  "Relaxed fit",
  "Not applicable",
];

const MAX_PHOTOS = 6;
const MAX_FILE_SIZE = 8 * 1024 * 1024;

const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function splitValues(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export default function ProductForm({ shopId, onAdded }: Props) {
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [gender, setGender] = useState("Women");
  const [category, setCategory] = useState("Women");
  const [subcategory, setSubcategory] = useState("Clothing");
  const [colorInput, setColorInput] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [sizeInput, setSizeInput] = useState("");
  const [stockQuantity, setStockQuantity] = useState("1");
  const [sellerLocation, setSellerLocation] = useState("");
  const [fitType, setFitType] = useState("True to size");
  const [fitNote, setFitNote] = useState("");
  const [type, setType] = useState<ListingType>("new");
  const [condition, setCondition] =
    useState<Condition>("like_new");

  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [fileKey, setFileKey] = useState(0);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function clearPreviews() {
    previews.forEach((url) => URL.revokeObjectURL(url));
    setPreviews([]);
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files;

    if (!selected || selected.length === 0) {
      clearPreviews();
      setFiles([]);
      return;
    }

    const chosen = Array.from(selected).slice(0, MAX_PHOTOS);

    if (selected.length > MAX_PHOTOS) {
      setError(
        `You can add up to ${MAX_PHOTOS} photos. The first ${MAX_PHOTOS} were selected.`,
      );
    } else {
      setError("");
    }

    const invalidType = chosen.find(
      (file) => !allowedTypes.has(file.type),
    );

    if (invalidType) {
      clearPreviews();
      setFiles([]);
      setError("Use JPG, PNG, or WebP images only.");
      return;
    }

    const oversized = chosen.find(
      (file) => file.size > MAX_FILE_SIZE,
    );

    if (oversized) {
      clearPreviews();
      setFiles([]);
      setError("Each photo must be 8 MB or smaller.");
      return;
    }

    clearPreviews();
    setFiles(chosen);
    setPreviews(
      chosen.map((file) => URL.createObjectURL(file)),
    );
  }

  function removePhoto(index: number) {
    const removedPreview = previews[index];

    if (removedPreview) {
      URL.revokeObjectURL(removedPreview);
    }

    setFiles(
      files.filter((_, fileIndex) => fileIndex !== index),
    );

    setPreviews(
      previews.filter(
        (_, previewIndex) => previewIndex !== index,
      ),
    );

    if (files.length <= 1) {
      setFileKey((key) => key + 1);
    }

    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      setError("You must be logged in to post a product.");
      return;
    }

    setBusy(true);
    setError("");

    const uploadedPaths: string[] = [];

    try {
      if (files.length === 0) {
        throw new Error("Add at least one product photo.");
      }

      if (!title.trim()) {
        throw new Error("Enter the product name.");
      }

      if (title.trim().length > 120) {
        throw new Error(
          "Product name must be 120 characters or fewer.",
        );
      }

      const p = Math.round(Number(price));

      if (!Number.isFinite(p) || p <= 0 || p > 100000000) {
        throw new Error(
          "Enter a valid price greater than zero.",
        );
      }

      const parsedSalePrice = salePrice.trim()
        ? Math.round(Number(salePrice))
        : null;

      if (
        parsedSalePrice !== null &&
        (!Number.isFinite(parsedSalePrice) ||
          parsedSalePrice <= 0 ||
          parsedSalePrice >= p)
      ) {
        throw new Error(
          "Sale price must be lower than the regular price.",
        );
      }

      const stock = Math.round(Number(stockQuantity));

      if (!Number.isFinite(stock) || stock < 0) {
        throw new Error(
          "Enter a valid stock quantity.",
        );
      }

      const sizes = splitValues(sizeInput);
      const colors = splitValues(colorInput);

      if (sizes.length === 0) {
        throw new Error(
          "Enter at least one size. Use commas for multiple sizes.",
        );
      }

      if (colors.length === 0) {
        throw new Error(
          "Enter at least one color. Use commas for multiple colors.",
        );
      }

      if (description.trim().length > 1200) {
        throw new Error(
          "Description must be 1,200 characters or fewer.",
        );
      }

      const photoUrls: string[] = [];

      for (const file of files) {
        if (!allowedTypes.has(file.type)) {
          throw new Error(
            "Use JPG, PNG, or WebP images only.",
          );
        }

        if (file.size > MAX_FILE_SIZE) {
          throw new Error(
            "Each photo must be 8 MB or smaller.",
          );
        }

        const blob = await resizeImage(file);

        const path =
          user.id +
          "/" +
          crypto.randomUUID() +
          ".jpg";

        const { error: uploadError } =
          await supabase.storage
            .from("shoe-images")
            .upload(path, blob, {
              contentType: "image/jpeg",
              upsert: false,
            });

        if (uploadError) {
          throw uploadError;
        }

        uploadedPaths.push(path);

        const { data: publicData } =
          supabase.storage
            .from("shoe-images")
            .getPublicUrl(path);

        photoUrls.push(publicData.publicUrl);
      }

      const { data: shoe, error: shoeError } =
        await supabase
          .from("shoes")
          .insert({
            shop_id: shopId,
            title: title.trim(),
            brand: brand.trim() || null,
            category: category.trim(),
            subcategory: subcategory.trim(),
            gender,
            color: colors[0] || null,
            colors,
            description: description.trim() || null,
            price: p,
            sale_price: parsedSalePrice,
            size: sizes[0] || null,
            sizes,
            listing_type: type,
            condition:
              type === "second_hand"
                ? condition
                : null,
            seller_location:
              sellerLocation.trim() || null,
            fit_type: fitType,
            fit_note: fitNote.trim() || null,
            stock_quantity: stock,
            is_available: stock > 0,
            is_featured: false,
            photo_url: photoUrls[0],
          })
          .select("id")
          .single();

      if (shoeError) {
        throw shoeError;
      }

      const photoRows = photoUrls.map(
        (photo_url, index) => ({
          shoe_id: shoe.id,
          photo_url,
          sort_order: index,
        }),
      );

      const { error: photoError } =
        await supabase
          .from("shoe_photos")
          .insert(photoRows);

      if (photoError) {
        await supabase
          .from("shoes")
          .delete()
          .eq("id", shoe.id);

        throw photoError;
      }

      clearPreviews();

      setTitle("");
      setBrand("");
      setGender("Women");
      setCategory("Women");
      setSubcategory("Clothing");
      setColorInput("");
      setDescription("");
      setPrice("");
      setSalePrice("");
      setSizeInput("");
      setStockQuantity("1");
      setSellerLocation("");
      setFitType("True to size");
      setFitNote("");
      setType("new");
      setCondition("like_new");
      setFiles([]);
      setFileKey((key) => key + 1);

      onAdded();
    } catch (err) {
      if (uploadedPaths.length > 0) {
        await supabase.storage
          .from("shoe-images")
          .remove(uploadedPaths);
      }

      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="form card-form product-form"
    >
      <div className="product-form-heading">
        <div>
          <p className="eyebrow">New listing</p>
          <strong>Add a fashion product</strong>
          <p className="muted small">
            Give buyers accurate details, sizing and clear
            photos.
          </p>
        </div>

        <span className="product-form-limit">
          Up to {MAX_PHOTOS} photos
        </span>
      </div>

      <div className="product-upload">
        <label className="product-upload-label">
          <span className="product-upload-title">
            Product photos
          </span>

          <span className="product-upload-help">
            Front, back, fabric close-up and worn photo
            recommended. JPG, PNG or WebP · max 8 MB each
          </span>

          <input
            key={fileKey}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleFiles}
            disabled={busy}
            required={files.length === 0}
          />
        </label>

        {previews.length > 0 && (
          <div className="product-preview-grid">
            {previews.map((preview, index) => (
              <div
                className="product-preview"
                key={preview}
              >
                <img
                  src={preview}
                  alt={
                    "Selected product photo " +
                    (index + 1)
                  }
                />

                {index === 0 && (
                  <span className="product-main-label">
                    Main
                  </span>
                )}

                <button
                  type="button"
                  className="product-remove-photo"
                  onClick={() => removePhoto(index)}
                  disabled={busy}
                  aria-label={
                    "Remove photo " +
                    (index + 1)
                  }
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="product-photo-status">
          <span>
            {files.length} / {MAX_PHOTOS} photos selected
          </span>

          {files.length > 0 && (
            <span>
              First photo is your marketplace photo
            </span>
          )}
        </div>
      </div>

      <div className="seg">
        <button
          type="button"
          className={type === "new" ? "on" : ""}
          onClick={() => setType("new")}
          disabled={busy}
        >
          New
        </button>

        <button
          type="button"
          className={
            type === "second_hand" ? "on" : ""
          }
          onClick={() => setType("second_hand")}
          disabled={busy}
        >
          Thrift / Second-hand
        </button>
      </div>

      <div className="product-form-grid">
        <label className="field">
          Product name
          <input
            value={title}
            onChange={(event) =>
              setTitle(event.target.value)
            }
            placeholder="African print dress"
            maxLength={120}
            disabled={busy}
            required
          />
        </label>

        <label className="field">
          Brand
          <input
            value={brand}
            onChange={(event) =>
              setBrand(event.target.value)
            }
            placeholder="Your brand or manufacturer"
            maxLength={80}
            disabled={busy}
          />
        </label>

        <label className="field">
          Audience
          <select
            value={gender}
            onChange={(event) =>
              setGender(event.target.value)
            }
            disabled={busy}
            required
          >
            <option>Women</option>
            <option>Men</option>
            <option>Kids</option>
            <option>Unisex</option>
          </select>
        </label>

        <label className="field">
          Category
          <select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value)
            }
            disabled={busy}
            required
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          Product type
          <select
            value={subcategory}
            onChange={(event) =>
              setSubcategory(event.target.value)
            }
            disabled={busy}
            required
          >
            {subcategories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          Colors
          <input
            value={colorInput}
            onChange={(event) =>
              setColorInput(event.target.value)
            }
            placeholder="Black, White, Gold"
            maxLength={300}
            disabled={busy}
            required
          />
          <small className="muted">
            Separate multiple colors with commas.
          </small>
        </label>

        <label className="field">
          Sizes
          <input
            value={sizeInput}
            onChange={(event) =>
              setSizeInput(event.target.value)
            }
            placeholder="S, M, L, XL"
            maxLength={300}
            disabled={busy}
            required
          />
          <small className="muted">
            Separate multiple sizes with commas.
          </small>
        </label>

        <label className="field">
          Stock quantity
          <input
            value={stockQuantity}
            onChange={(event) =>
              setStockQuantity(
                event.target.value.replace(
                  /[^\d]/g,
                  "",
                ),
              )
            }
            inputMode="numeric"
            placeholder="10"
            disabled={busy}
            required
          />
        </label>

        <label className="field">
          Price (UGX)
          <input
            value={price}
            onChange={(event) =>
              setPrice(
                event.target.value.replace(
                  /[^\d]/g,
                  "",
                ),
              )
            }
            inputMode="numeric"
            placeholder="180000"
            disabled={busy}
            required
          />
        </label>

        <label className="field">
          Sale price (UGX)
          <input
            value={salePrice}
            onChange={(event) =>
              setSalePrice(
                event.target.value.replace(
                  /[^\d]/g,
                  "",
                ),
              )
            }
            inputMode="numeric"
            placeholder="150000"
            disabled={busy}
          />
          <small className="muted">
            Optional weekend or promotional price.
          </small>
        </label>

        <label className="field">
          Seller location
          <input
            value={sellerLocation}
            onChange={(event) =>
              setSellerLocation(event.target.value)
            }
            placeholder="Kampala, Ntinda"
            maxLength={120}
            disabled={busy}
          />
        </label>

        <label className="field">
          Fit
          <select
            value={fitType}
            onChange={(event) =>
              setFitType(event.target.value)
            }
            disabled={busy}
          >
            {fitTypes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field">
        Fit note
        <input
          value={fitNote}
          onChange={(event) =>
            setFitNote(event.target.value)
          }
          placeholder="Example: Model is wearing M. Consider one size up."
          maxLength={240}
          disabled={busy}
        />
      </label>

      {type === "second_hand" && (
        <label className="field">
          Condition
          <select
            value={condition}
            onChange={(event) =>
              setCondition(
                event.target.value as Condition,
              )
            }
            disabled={busy}
          >
            <option value="like_new">Like new</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
          </select>
        </label>
      )}

      <label className="field">
        Description
        <textarea
          value={description}
          onChange={(event) =>
            setDescription(event.target.value)
          }
          placeholder="Tell buyers about the material, design, fit, condition, delivery or anything useful..."
          rows={5}
          maxLength={1200}
          disabled={busy}
        />

        <small className="muted">
          {description.length} / 1200 characters
        </small>
      </label>

      {error && (
        <div className="product-form-error">
          <strong>Could not post listing</strong>
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        className="btn gold product-submit"
        disabled={busy}
      >
        {busy
          ? "Uploading listing..."
          : "Publish fashion listing"}
      </button>

      {busy && (
        <p className="muted small product-uploading-note">
          Uploading your photos and creating the real
          marketplace listing. Please keep this page open.
        </p>
      )}
    </form>
  );
}