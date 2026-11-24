import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fashionApi } from '../../api/client';
import {
  EditorialButton,
  FieldInput,
  GarmentArtwork,
  StateCard,
  StatusBadge,
} from '../../components/UiPrimitives';
import { mockServer } from '../../mock/mockServer';
import { useApp } from '../../state/AppContext';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { CatalogStatus, Category, EntityId, Product, ProductImage, Variant } from '../../types/api';
import { formatVnd } from '../../utils/format';

/** Admin/Staff catalog panel managing Categories, Products, Variants, and storageKey Images (M1-10). */
export function AdminCatalogPanel(): React.ReactElement {
  const { user, handleApiError, showToast } = useApp();
  const isAdmin = user?.role === 'ADMIN';

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<EntityId | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [images, setImages] = useState<ProductImage[]>([]);

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Category form state
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catSaving, setCatSaving] = useState(false);

  // Product create/edit state
  const [prodName, setProdName] = useState('');
  const [prodSlug, setProdSlug] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodCatId, setProdCatId] = useState<EntityId>('1');
  const [prodStatus, setProdStatus] = useState<CatalogStatus>('ACTIVE');
  const [prodSaving, setProdSaving] = useState(false);

  // Selected product inline description edit (available to Admin & Staff catalog.content.edit)
  const [editDesc, setEditDesc] = useState('');

  // Variant create state
  const [varSku, setVarSku] = useState('');
  const [varSize, setVarSize] = useState('M');
  const [varColor, setVarColor] = useState('Đen');
  const [varPrice, setVarPrice] = useState('450000.00');
  const [varSaving, setVarSaving] = useState(false);

  // Image storageKey link state
  const [imgKey, setImgKey] = useState('garments/linen-ivory.jpg');
  const [imgAlt, setImgAlt] = useState('');
  const [imgSaving, setImgSaving] = useState(false);

  /** Load categories and all products (including INACTIVE) for Admin catalog view. */
  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catList, prodPage] = await Promise.all([
        fashionApi.listAdminCategories(),
        fashionApi.listAdminProducts(1, 50),
      ]);
      setCategories(catList);
      setProducts(prodPage.items);
      if (catList[0]) {
        setProdCatId((prev) => prev || catList[0].id);
      }
      if (prodPage.items[0] && !selectedProductId) {
        setSelectedProductId(prodPage.items[0].id);
      }
    } catch (err) {
      setError(handleApiError(err, 'Không thể tải Admin Catalog.'));
    } finally {
      setLoading(false);
    }
  }, [handleApiError, selectedProductId]);

  /** Load variants and images for the currently selected product. */
  const loadProductChildren = useCallback(
    async (pid: EntityId) => {
      setDetailLoading(true);
      try {
        const [vList, imgList] = await Promise.all([
          isAdmin ? fashionApi.listAdminVariants(pid) : Promise.resolve([]),
          fashionApi.listAdminImages(pid),
        ]);
        setVariants(vList);
        setImages(imgList);
        const prod = products.find((p) => p.id === pid);
        if (prod) setEditDesc(prod.description);
      } catch (err) {
        showToast('error', handleApiError(err));
      } finally {
        setDetailLoading(false);
      }
    },
    [handleApiError, isAdmin, products, showToast],
  );

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (selectedProductId) {
      void loadProductChildren(selectedProductId);
    }
  }, [loadProductChildren, selectedProductId]);

  /** Create a new category (Admin only). */
  const handleCreateCategory = async () => {
    setCatSaving(true);
    try {
      await fashionApi.createAdminCategory({
        name: catName,
        slug: catSlug,
        status: 'ACTIVE',
      });
      setCatName('');
      setCatSlug('');
      showToast('success', 'Đã tạo danh mục mới.');
      await loadCatalog();
    } catch (err) {
      showToast('error', handleApiError(err));
    } finally {
      setCatSaving(false);
    }
  };

  /** Create a new product (Admin only). */
  const handleCreateProduct = async () => {
    setProdSaving(true);
    try {
      const created = await fashionApi.createAdminProduct({
        categoryId: prodCatId,
        name: prodName,
        slug: prodSlug,
        description: prodDesc,
        status: prodStatus,
      });
      setProdName('');
      setProdSlug('');
      setProdDesc('');
      setSelectedProductId(created.id);
      showToast('success', `Đã tạo sản phẩm #${created.id}.`);
      await loadCatalog();
    } catch (err) {
      showToast('error', handleApiError(err));
    } finally {
      setProdSaving(false);
    }
  };

  /** Toggle product ACTIVE / INACTIVE status (Admin only). */
  const handleToggleProductStatus = async (prod: Product) => {
    try {
      await fashionApi.updateAdminProduct(prod.id, {
        status: prod.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      });
      showToast('success', `Đã cập nhật trạng thái ${prod.name}.`);
      await loadCatalog();
    } catch (err) {
      showToast('error', handleApiError(err));
    }
  };

  /** Save edited product description (Admin or Staff with catalog.content.edit). */
  const handleSaveDescription = async () => {
    if (!selectedProductId) return;
    try {
      await fashionApi.updateAdminProduct(selectedProductId, { description: editDesc });
      showToast('success', 'Đã cập nhật mô tả sản phẩm.');
      await loadCatalog();
    } catch (err) {
      showToast('error', handleApiError(err));
    }
  };

  /** Create a new variant starting at stockQuantity = 0 (Admin only). */
  const handleCreateVariant = async () => {
    if (!selectedProductId) return;
    setVarSaving(true);
    try {
      await fashionApi.createAdminVariant(selectedProductId, {
        sku: varSku,
        size: varSize,
        color: varColor,
        price: varPrice,
        status: 'ACTIVE',
      });
      setVarSku('');
      showToast('success', 'Đã thêm biến thể (tồn ban đầu = 0).');
      await loadCatalog();
      await loadProductChildren(selectedProductId);
    } catch (err) {
      showToast('error', handleApiError(err));
    } finally {
      setVarSaving(false);
    }
  };

  /** Link an existing local storageKey image to selected product (Admin or Staff catalog.content.edit). */
  const handleAddImage = async () => {
    if (!selectedProductId) return;
    setImgSaving(true);
    try {
      await fashionApi.createAdminImage(selectedProductId, {
        storageKey: imgKey,
        altText: imgAlt || undefined,
        sortOrder: images.length,
      });
      setImgAlt('');
      showToast('success', 'Đã liên kết ảnh vào sản phẩm.');
      await loadCatalog();
      await loadProductChildren(selectedProductId);
    } catch (err) {
      showToast('error', handleApiError(err));
    } finally {
      setImgSaving(false);
    }
  };

  if (loading) {
    return <StateCard kind="loading" title="Đang tải danh mục quản trị..." />;
  }

  if (error) {
    return (
      <StateCard
        kind="error"
        title="Không thể truy cập Catalog quản trị"
        message={error}
        actionLabel="Thử lại"
        onAction={() => void loadCatalog()}
      />
    );
  }

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const availableKeys = mockServer.listAvailableStorageKeys();

  return (
    <View style={styles.stack}>
      {/* Categories Section */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Danh mục sản phẩm ({categories.length})</Text>
        <View style={styles.rowWrap}>
          {categories.map((c) => (
            <View key={c.id} style={styles.tagItem}>
              <Text style={styles.tagText}>
                #{c.id} {c.name} ({c.slug})
              </Text>
              <StatusBadge label={c.status} tone={c.status === 'ACTIVE' ? 'success' : 'neutral'} />
              {isAdmin ? (
                <EditorialButton
                  label={c.status === 'ACTIVE' ? 'Ẩn' : 'Bật'}
                  variant="ghost"
                  compact
                  onPress={async () => {
                    try {
                      await fashionApi.updateAdminCategory(c.id, {
                        status: c.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                      });
                      await loadCatalog();
                    } catch (err) {
                      showToast('error', handleApiError(err));
                    }
                  }}
                />
              ) : null}
            </View>
          ))}
        </View>

        {isAdmin ? (
          <View style={styles.inlineForm}>
            <Text style={styles.subTitle}>Tạo danh mục mới</Text>
            <View style={styles.formRow}>
              <View style={{ flex: 1 }}>
                <FieldInput
                  label="Tên danh mục"
                  value={catName}
                  onChangeText={setCatName}
                  placeholder="Áo kiểu Linen"
                />
              </View>
              <View style={{ flex: 1 }}>
                <FieldInput
                  label="Slug"
                  value={catSlug}
                  onChangeText={setCatSlug}
                  placeholder="ao-kieu-linen"
                />
              </View>
            </View>
            <EditorialButton
              label="Tạo danh mục"
              compact
              loading={catSaving}
              onPress={() => void handleCreateCategory()}
            />
          </View>
        ) : null}
      </View>

      {/* Products Table + Creation */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Sản phẩm ({products.length})</Text>
        <View style={styles.listStack}>
          {products.map((p) => {
            const selected = p.id === selectedProductId;
            return (
              <Pressable
                key={p.id}
                onPress={() => setSelectedProductId(p.id)}
                style={[styles.productRow, selected && styles.productRowActive]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.boldText}>
                    #{p.id} · {p.name}
                  </Text>
                  <Text style={styles.mutedText}>
                    Slug: {p.slug} · {p.variants.length} biến thể · {p.images.length} ảnh
                  </Text>
                </View>
                <StatusBadge
                  label={p.status}
                  tone={p.status === 'ACTIVE' ? 'success' : 'warning'}
                />
                {isAdmin ? (
                  <EditorialButton
                    label={p.status === 'ACTIVE' ? 'Ẩn' : 'Xuất bản'}
                    variant="secondary"
                    compact
                    onPress={() => void handleToggleProductStatus(p)}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {isAdmin ? (
          <View style={styles.inlineForm}>
            <Text style={styles.subTitle}>Thêm sản phẩm mới</Text>
            <FieldInput
              label="Tên sản phẩm"
              value={prodName}
              onChangeText={setProdName}
              placeholder="Áo Sơ mi Poplin Trắng"
            />
            <FieldInput
              label="Slug (duy nhất)"
              value={prodSlug}
              onChangeText={setProdSlug}
              placeholder="ao-so-mi-poplin-trang"
            />
            <FieldInput
              label="Mô tả"
              value={prodDesc}
              onChangeText={setProdDesc}
              placeholder="Chất liệu thoáng mát..."
            />
            <View style={styles.rowWrap}>
              <Text style={styles.mutedText}>Danh mục:</Text>
              {categories.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setProdCatId(c.id)}
                  style={[styles.miniChip, prodCatId === c.id && styles.miniChipActive]}
                >
                  <Text style={styles.miniChipText}>{c.name}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.rowWrap}>
              {(['ACTIVE', 'INACTIVE'] as const).map((st) => (
                <Pressable
                  key={st}
                  onPress={() => setProdStatus(st)}
                  style={[styles.miniChip, prodStatus === st && styles.miniChipActive]}
                >
                  <Text style={styles.miniChipText}>{st}</Text>
                </Pressable>
              ))}
            </View>
            <EditorialButton
              label="Tạo sản phẩm"
              compact
              loading={prodSaving}
              onPress={() => void handleCreateProduct()}
            />
          </View>
        ) : null}
      </View>

      {/* Selected Product Variants, Description & storageKey Images */}
      {selectedProduct ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>
            Chi tiết biến thể & Ảnh: {selectedProduct.name}
          </Text>

          <FieldInput
            label="Chỉnh sửa mô tả (Admin & Staff catalog.content.edit)"
            value={editDesc}
            onChangeText={setEditDesc}
            multiline
          />
          <EditorialButton
            label="Lưu mô tả"
            variant="secondary"
            compact
            onPress={() => void handleSaveDescription()}
          />

          <View style={styles.divider} />
          <Text style={styles.subTitle}>Biến thể SKU</Text>
          {detailLoading ? (
            <StateCard kind="loading" title="Đang tải biến thể..." />
          ) : !isAdmin ? (
            <Text style={styles.mutedText}>
              Quản lý giá và tạo/xóa SKU thuộc quyền Admin (Staff chỉ chỉnh mô tả và ảnh theo Q10).
            </Text>
          ) : (
            <>
              {variants.length === 0 ? (
                <StateCard kind="empty" title="Chưa có biến thể nào" />
              ) : (
                variants.map((v) => (
                  <View key={v.id} style={styles.variantRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.boldText}>{v.sku}</Text>
                      <Text style={styles.mutedText}>
                        Size {v.size} · {v.color} · {formatVnd(v.price)} · Tồn: {v.stockQuantity}
                      </Text>
                    </View>
                    <StatusBadge
                      label={v.status}
                      tone={v.status === 'ACTIVE' ? 'success' : 'neutral'}
                    />
                    <EditorialButton
                      label={v.status === 'ACTIVE' ? 'Tắt' : 'Bật'}
                      variant="ghost"
                      compact
                      onPress={async () => {
                        try {
                          await fashionApi.updateAdminVariant(selectedProduct.id, v.id, {
                            status: v.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                          });
                          await loadProductChildren(selectedProduct.id);
                          await loadCatalog();
                        } catch (err) {
                          showToast('error', handleApiError(err));
                        }
                      }}
                    />
                  </View>
                ))
              )}

              <View style={styles.inlineForm}>
                <Text style={styles.subTitle}>Thêm biến thể mới (Tồn mặc định = 0)</Text>
                <FieldInput
                  label="SKU duy nhất"
                  value={varSku}
                  onChangeText={setVarSku}
                  placeholder="SOI-NEW-BLK-M"
                />
                <View style={styles.formRow}>
                  <View style={{ flex: 1 }}>
                    <FieldInput label="Size" value={varSize} onChangeText={setVarSize} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FieldInput label="Màu" value={varColor} onChangeText={setVarColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FieldInput
                      label="Giá Decimal"
                      value={varPrice}
                      onChangeText={setVarPrice}
                      placeholder="450000.00"
                    />
                  </View>
                </View>
                <EditorialButton
                  label="Thêm biến thể"
                  compact
                  loading={varSaving}
                  onPress={() => void handleCreateVariant()}
                />
              </View>
            </>
          )}

          <View style={styles.divider} />
          <Text style={styles.subTitle}>Ảnh sản phẩm (storageKey theo ADR-0004)</Text>
          <View style={styles.rowWrap}>
            {images.map((img) => (
              <View key={img.id} style={styles.imgCard}>
                <GarmentArtwork uri={img.url} altText={img.altText} height={90} />
                <Text style={styles.mutedText} numberOfLines={1}>
                  {img.altText}
                </Text>
                <EditorialButton
                  label="Gỡ ảnh"
                  variant="ghost"
                  compact
                  onPress={async () => {
                    try {
                      await fashionApi.removeAdminImage(selectedProduct.id, img.id);
                      await loadProductChildren(selectedProduct.id);
                      await loadCatalog();
                    } catch (err) {
                      showToast('error', handleApiError(err));
                    }
                  }}
                />
              </View>
            ))}
          </View>

          <View style={styles.inlineForm}>
            <Text style={styles.mutedText}>Chọn storageKey mẫu có sẵn:</Text>
            <View style={styles.rowWrap}>
              {availableKeys.map((key) => (
                <Pressable
                  key={key}
                  onPress={() => setImgKey(key)}
                  style={[styles.miniChip, imgKey === key && styles.miniChipActive]}
                >
                  <Text style={styles.miniChipText}>{key}</Text>
                </Pressable>
              ))}
            </View>
            <FieldInput label="storageKey" value={imgKey} onChangeText={setImgKey} />
            <FieldInput
              label="Mô tả ảnh (altText)"
              value={imgAlt}
              onChangeText={setImgAlt}
              placeholder="Góc chụp chính diện"
            />
            <EditorialButton
              label="Liên kết ảnh storageKey"
              compact
              loading={imgSaving}
              onPress={() => void handleAddImage()}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.lg,
    gap: spacing.md,
  },
  panelTitle: { fontFamily: typography.serif, fontSize: 19, color: colors.ink },
  subTitle: { fontFamily: typography.sans, fontSize: 14, fontWeight: '700', color: colors.ink },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  tagText: { fontFamily: typography.sans, fontSize: 12, color: colors.ink },
  inlineForm: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  formRow: { flexDirection: 'row', gap: spacing.sm },
  listStack: { gap: spacing.sm },
  productRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xs,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  productRowActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  boldText: { fontFamily: typography.sans, fontSize: 14, fontWeight: '600', color: colors.ink },
  mutedText: { fontFamily: typography.sans, fontSize: 12, color: colors.muted },
  miniChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.xs,
  },
  miniChipActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  miniChipText: { fontFamily: typography.sans, fontSize: 12, color: colors.ink },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xs,
    padding: spacing.sm,
  },
  imgCard: {
    width: 140,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xs,
    padding: spacing.xs,
    gap: 4,
  },
});
