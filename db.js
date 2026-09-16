(() => {
  'use strict';

  const config = window.RGC_SUPABASE_CONFIG || {};
  const configured = Boolean(
    config.url && config.key &&
    !String(config.url).includes('COLE_AQUI') &&
    !String(config.key).includes('COLE_AQUI') &&
    /^https:\/\//i.test(String(config.url))
  );

  let client = null;
  if (configured && window.supabase?.createClient) {
    client = window.supabase.createClient(config.url, config.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }

  const requireClient = () => {
    if (!client) {
      throw new Error('Banco de dados não configurado. Preencha supabase-config.js com a Project URL e a chave pública do Supabase.');
    }
    return client;
  };

  const publicImageUrl = (path) => {
    if (!path || !client) return '';
    const { data } = client.storage.from('property-images').getPublicUrl(path);
    return data?.publicUrl || '';
  };

  const mapProperty = (row) => ({
    id: row.id,
    title: row.title || '',
    category: row.category || 'Alto padrão',
    price: Number(row.price || 0),
    area: Number(row.area || 0),
    suites: Number(row.suites || 0),
    garages: Number(row.garages || 0),
    location: row.location || '',
    description: row.description || '',
    features: Array.isArray(row.features) ? row.features : [],
    imagePath: row.image_path || '',
    image: publicImageUrl(row.image_path),
    status: row.status || 'available',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  });

  const mapSale = (row) => ({
    id: row.id,
    number: row.receipt_number || '',
    propertyId: row.property_id || '',
    propertyTitle: row.property_title_snapshot || 'Venda sem imóvel cadastrado',
    propertyLocation: row.property_location_snapshot || '',
    buyerName: row.buyer_name || '',
    buyerDocument: row.buyer_document || '',
    buyerPhone: row.buyer_phone || '',
    buyerEmail: row.buyer_email || '',
    saleDate: row.sale_date || '',
    value: Number(row.sale_value || 0),
    entry: Number(row.entry_value || 0),
    paymentMethod: row.payment_method || '',
    installments: Number(row.installments || 0),
    notes: row.notes || '',
    createdAt: row.created_at || ''
  });

  async function getPublicProperties() {
    const sb = requireClient();
    const { data, error } = await sb
      .from('properties')
      .select('*')
      .in('status', ['available', 'reserved'])
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapProperty);
  }

  async function getOwnerProperties() {
    const sb = requireClient();
    const { data, error } = await sb
      .from('properties')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapProperty);
  }

  async function getSales() {
    const sb = requireClient();
    const { data, error } = await sb
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapSale);
  }

  async function signIn(email, password) {
    const sb = requireClient();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const owner = await getOwnerProfile(data.user?.id);
    if (!owner) {
      await sb.auth.signOut();
      throw new Error('Esta conta existe, mas não possui permissão de proprietário.');
    }
    return { user: data.user, profile: owner };
  }

  async function signOut() {
    const sb = requireClient();
    const { error } = await sb.auth.signOut();
    if (error) throw error;
  }

  async function getSession() {
    const sb = requireClient();
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    return data.session || null;
  }

  async function getOwnerProfile(userId) {
    const sb = requireClient();
    if (!userId) return null;
    const { data, error } = await sb
      .from('owner_profiles')
      .select('user_id, display_name, role, created_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function updateOwnerProfile(userId, displayName) {
    const sb = requireClient();
    const { data, error } = await sb
      .from('owner_profiles')
      .update({ display_name: displayName.trim() })
      .eq('user_id', userId)
      .select('user_id, display_name, role, created_at')
      .single();
    if (error) throw error;
    return data;
  }

  async function updatePassword(password) {
    const sb = requireClient();
    const { data, error } = await sb.auth.updateUser({ password });
    if (error) throw error;
    return data.user;
  }

  async function uploadPropertyImage({ propertyId, blob }) {
    const sb = requireClient();
    const { data: authData, error: authError } = await sb.auth.getUser();
    if (authError) throw authError;
    const userId = authData.user?.id;
    if (!userId) throw new Error('Sessão de proprietário expirada. Entre novamente.');

    const path = `${userId}/${propertyId}/${Date.now()}.jpg`;
    const { error } = await sb.storage
      .from('property-images')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: false, cacheControl: '3600' });
    if (error) throw error;

    return path;
  }

  async function deleteStorageImage(path) {
    if (!path) return;
    const sb = requireClient();
    const { error } = await sb.storage.from('property-images').remove([path]);
    if (error) throw error;
  }

  async function saveProperty(property) {
    const sb = requireClient();
    const payload = {
      id: property.id,
      title: property.title,
      category: property.category,
      price: property.price,
      area: property.area,
      suites: property.suites,
      garages: property.garages,
      location: property.location || null,
      description: property.description || null,
      features: property.features || [],
      image_path: property.imagePath || null,
      status: property.status
    };

    const { data, error } = await sb
      .from('properties')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single();
    if (error) throw error;
    return mapProperty(data);
  }

  async function updatePropertyStatus(id, status) {
    const sb = requireClient();
    const { data, error } = await sb
      .from('properties')
      .update({ status })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return mapProperty(data);
  }

  async function hasSalesForProperty(id) {
    const sb = requireClient();
    const { count, error } = await sb
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', id);
    if (error) throw error;
    return Number(count || 0) > 0;
  }

  async function deleteProperty(id, imagePath = '') {
    const sb = requireClient();
    const { error } = await sb.from('properties').delete().eq('id', id);
    if (error) throw error;
    if (imagePath) {
      const { error: imageError } = await sb.storage.from('property-images').remove([imagePath]);
      if (imageError) console.warn('Imóvel removido, mas não foi possível remover a foto antiga:', imageError.message);
    }
  }

  async function registerSale(sale) {
    const sb = requireClient();
    const { data, error } = await sb.rpc('register_sale', {
      p_property_id: sale.propertyId || null,
      p_buyer_name: sale.buyerName,
      p_buyer_document: sale.buyerDocument || null,
      p_buyer_phone: sale.buyerPhone || null,
      p_buyer_email: sale.buyerEmail || null,
      p_sale_date: sale.saleDate,
      p_sale_value: sale.value,
      p_entry_value: sale.entry,
      p_payment_method: sale.paymentMethod || null,
      p_installments: sale.installments || 0,
      p_notes: sale.notes || null,
      p_mark_sold: Boolean(sale.markSold)
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return mapSale(row);
  }

  window.RGCDB = {
    configured,
    client,
    getPublicProperties,
    getOwnerProperties,
    getSales,
    signIn,
    signOut,
    getSession,
    getOwnerProfile,
    updateOwnerProfile,
    updatePassword,
    uploadPropertyImage,
    deleteStorageImage,
    saveProperty,
    updatePropertyStatus,
    hasSalesForProperty,
    deleteProperty,
    registerSale,
    publicImageUrl
  };
})();
