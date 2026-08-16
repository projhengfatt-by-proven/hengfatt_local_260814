import { supabase } from "@/integrations/supabase/client";

/**
 * Shared listing-creation action, used by both the admin "Create Listing"
 * flow (/admin/listings/new) and the agent portal's "New Listing" flow
 * (/portal/agent/listings/new) — both mount the same NewListingPage
 * component, and creating a listing is the same operation regardless of
 * which portal the caller is in. This is the single source of truth for
 * the mutation; the page component only collects input and uploads files.
 */

export type ListingFormFields = {
  transaction_type: string;
  property_type: string;
  property_name: string;
  unit_number: string;
  address: string;
  postal_code: string;
  district: string;
  mrt_nearest: string;
  mrt_distance_m: string;
  title: string;
  title_zh: string;
  size_sqft: string;
  floor_level: string;
  bedrooms: number;
  bathrooms: number;
  car_parks: number;
  tenure: string;
  top_year: string;
  facing: string;
  furnishing: string;
  price: string;
  monthly_rental: string;
  price_on_enquiry: boolean;
  description_en: string;
  description_zh: string;
  virtual_tour_url: string;
  cobroke_enabled: boolean;
  cobroke_commission: string;
  owner_bottom_price: string;
  reason_for_selling: string;
  owner_urgency: string;
  private_notes: string;
};

export type ListingPhotoInput = { file?: File; url: string; is_cover: boolean };
export type ListingFloorPlanInput = { file?: File; url: string; label: string };

export async function createListing(params: {
  ownerId: string;
  createdByUserId: string;
  isDraft: boolean;
  fields: ListingFormFields;
  photos: ListingPhotoInput[];
  floorPlans: ListingFloorPlanInput[];
  linkFolderName?: string | null;
}) {
  const { ownerId, createdByUserId, isDraft, fields, photos, floorPlans, linkFolderName } = params;

  const { data: property, error } = await supabase
    .from("properties")
    .insert({
      agent_id: ownerId,
      title: fields.title || fields.property_name || "Untitled",
      property_name: fields.property_name || null,
      unit_number: fields.unit_number || null,
      address: fields.address || null,
      postal_code: fields.postal_code || null,
      district: fields.district ? parseInt(fields.district) : null,
      type: (fields.property_type || "Condo") as any,
      transaction_type: (fields.transaction_type || "sale") as any,
      price: fields.price_on_enquiry ? null : (parseFloat(fields.price) || null),
      monthly_rental: fields.price_on_enquiry ? null : (parseFloat(fields.monthly_rental) || null),
      price_on_enquiry: fields.price_on_enquiry,
      size_sqft: parseFloat(fields.size_sqft) || null,
      bedrooms: fields.bedrooms || null,
      bathrooms: fields.bathrooms || null,
      car_parks: fields.car_parks || 0,
      floor_level: fields.floor_level || null,
      tenure: fields.tenure ? (fields.tenure as any) : null,
      top_year: fields.top_year ? parseInt(fields.top_year) : null,
      facing: fields.facing || null,
      furnishing: fields.furnishing || null,
      mrt_nearest: fields.mrt_nearest || null,
      mrt_distance_m: fields.mrt_distance_m ? parseInt(fields.mrt_distance_m) : null,
      description_en: fields.description_en || null,
      description_zh: fields.description_zh || null,
      virtual_tour_url: fields.virtual_tour_url || null,
      cobroke_enabled: fields.cobroke_enabled,
      cobroke_commission: fields.cobroke_commission ? parseFloat(fields.cobroke_commission) : null,
      status: isDraft ? "draft" : "active",
      approval_status: "approved",
      is_featured: false,
      view_count: 0,
    } as any)
    .select()
    .single();

  if (error || !property) {
    return { data: null, error };
  }

  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    let url = p.url;
    if (p.file) {
      const ext = p.file.name.split(".").pop();
      const path = `${property.id}/${Date.now()}-${i}.${ext}`;
      const { error: upErr } = await supabase.storage.from("property-images").upload(path, p.file);
      if (!upErr) {
        const { data: pub } = supabase.storage.from("property-images").getPublicUrl(path);
        url = pub.publicUrl;
      }
    }
    if (url) {
      await supabase.from("property_images").insert({
        property_id: property.id,
        url,
        is_cover: i === 0,
        display_order: i,
      });
    }
  }

  for (let i = 0; i < floorPlans.length; i++) {
    const fp = floorPlans[i];
    let url = fp.url;
    if (fp.file) {
      const path = `${property.id}/floor-${Date.now()}-${i}.${fp.file.name.split(".").pop()}`;
      const { error: upErr } = await supabase.storage.from("floor-plans").upload(path, fp.file);
      if (!upErr) {
        const { data: pub } = supabase.storage.from("floor-plans").getPublicUrl(path);
        url = pub.publicUrl;
      }
    }
    if (url) {
      await supabase.from("property_floor_plans").insert({
        property_id: property.id,
        url,
        label: fp.label || `Plan ${i + 1}`,
        display_order: i,
      });
    }
  }

  if (fields.owner_bottom_price || fields.private_notes || fields.reason_for_selling) {
    await supabase.from("property_private_notes").insert({
      property_id: property.id,
      agent_id: createdByUserId,
      owner_bottom_price: fields.owner_bottom_price ? parseFloat(fields.owner_bottom_price) : null,
      reason_for_selling: fields.reason_for_selling || null,
      owner_urgency: fields.owner_urgency || null,
      private_notes: fields.private_notes || null,
    });
  }

  if (linkFolderName) {
    await supabase
      .from("agent_files")
      .update({ property_id: property.id })
      .eq("agent_id", createdByUserId)
      .eq("folder_name", linkFolderName);
  }

  return { data: property, error: null };
}
