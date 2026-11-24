import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { fashionApi } from '../../api/client';
import {
  FadeSlideIn,
  FloatingAmbient,
  InteractiveCard,
  ShimmerBlock,
} from '../../components/Motion';
import { EditorialButton, GarmentArtwork, StateCard } from '../../components/UiPrimitives';
import { useApp } from '../../state/AppContext';
import {
  colors,
  radius,
  resolveColorSwatch,
  shadows,
  spacing,
  typography,
} from '../../theme/tokens';
import { Category, EntityId, Product, ProductSort } from '../../types/api';
import { formatVnd, getLowestActivePrice, getTotalActiveStock } from '../../utils/format';

const SIZES = ['S', 'M', 'L', 'XL'];
const COLORS = ['Trắng', 'Đen', 'Xanh Indigo', 'Xám Đá', 'Be', 'Xanh Rêu', 'Nâu'];
const SORT_OPTIONS: Array<{ value: ProductSort; label: string }> = [
  { value: 'NEWEST', label: 'Mới nhất' },
  { value: 'PRICE_ASC', label: 'Giá tăng dần' },
  { value: 'PRICE_DESC', label: 'Giá giảm dần' },
];

/** Customer storefront screen with rounded lookbook cards, floating hero, and staggered animations. */
export function CatalogScreen(): React.ReactElement {
  const { navigate, handleApiError } = useApp();
  const { width } = useWindowDimensions();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const pageSize = 6;

  const [searchInput, setSearchInput] = useState<string>('');
  const [appliedQ, setAppliedQ] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<EntityId | undefined>(undefined);
  const [selectedSize, setSelectedSize] = useState<string | undefined>(undefined);
  const [selectedColor, setSelectedColor] = useState<string | undefined>(undefined);
  const [sort, setSort] = useState<ProductSort>('NEWEST');

  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /** Load ACTIVE categories for filter pills. */
  const fetchCategories = useCallback(async () => {
    try {
      const list = await fashionApi.listCategories();
      setCategories(list);
    } catch {
      // Categories failure should not block product listing retry flow.
    }
  }, []);

  /** Fetch paginated ACTIVE products matching current filters and sort order. */
  const fetchProducts = useCallback(
    async (targetPage: number, append: boolean) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const res = await fashionApi.listProducts({
          page: targetPage,
          pageSize,
          q: appliedQ || undefined,
          categoryId: selectedCategoryId,
          size: selectedSize,
          color: selectedColor,
          sort,
        });
        setProducts((prev) => (append ? [...prev, ...res.items] : res.items));
        setTotal(res.total);
        setPage(res.page);
      } catch (err) {
        setError(handleApiError(err, 'Không thể tải danh sách sản phẩm.'));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [appliedQ, handleApiError, selectedCategoryId, selectedColor, selectedSize, sort],
  );

  useEffect(() => {
    void fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    void fetchProducts(1, false);
  }, [fetchProducts]);

  /** Clear all active search, category, size, color, and sort filters. */
  const clearFilters = () => {
    setSearchInput('');
    setAppliedQ('');
    setSelectedCategoryId(undefined);
    setSelectedSize(undefined);
    setSelectedColor(undefined);
    setSort('NEWEST');
  };

  const columns = width >= 980 ? 3 : width >= 620 ? 2 : 1;
  const hasActiveFilters = Boolean(
    appliedQ || selectedCategoryId || selectedSize || selectedColor || sort !== 'NEWEST',
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Soft rounded lookbook hero with layered depth & gentle ambient floating card */}
      <FadeSlideIn distance={16} duration={420}>
        <View style={[styles.hero, shadows.card]}>
          <View style={styles.heroGlowRight} />
          <View style={styles.heroGlowBottom} />

          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Sợi tự nhiên & Phom dáng kiến trúc</Text>
            <Text style={styles.heroSubtitle}>
              Bộ sưu tập may mặc thường nhật từ linen, cotton 260gsm và len merino. Thanh toán COD
              mô phỏng minh bạch, kiểm soát tồn kho theo từng SKU.
            </Text>
            <View style={styles.heroActions}>
              <EditorialButton label="Xem tất cả thiết kế" onPress={clearFilters} compact />
              <EditorialButton
                label="Theo dõi đơn hàng"
                variant="secondary"
                onPress={() => navigate({ name: 'orders' })}
                compact
              />
            </View>
          </View>

          {width >= 720 ? (
            <FloatingAmbient style={styles.heroVisual}>
              <View style={shadows.lifted}>
                <GarmentArtwork
                  uri="garment://%231E3A5F/coat/Atelier%20Lookbook"
                  altText="Bộ sưu tập Sợi Atelier"
                  height={200}
                />
              </View>
            </FloatingAmbient>
          ) : null}
        </View>
      </FadeSlideIn>

      {/* Soft pill-ruled search and filter panel */}
      <FadeSlideIn delay={60} distance={14} duration={380}>
        <View style={[styles.filterPanel, shadows.soft]}>
          <View style={styles.searchRow}>
            <TextInput
              value={searchInput}
              onChangeText={setSearchInput}
              onSubmitEditing={() => setAppliedQ(searchInput.trim())}
              placeholder="Tìm theo tên áo, quần, chất liệu hoặc SKU..."
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              returnKeyType="search"
            />
            <EditorialButton
              label="Tìm kiếm"
              onPress={() => setAppliedQ(searchInput.trim())}
              compact
            />
            {hasActiveFilters ? (
              <EditorialButton
                label="Xóa lọc"
                variant="secondary"
                onPress={clearFilters}
                compact
              />
            ) : null}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            <View style={styles.chipRow}>
              <FilterChip
                label="Tất cả danh mục"
                active={!selectedCategoryId}
                onPress={() => setSelectedCategoryId(undefined)}
              />
              {categories.map((cat) => (
                <FilterChip
                  key={cat.id}
                  label={cat.name}
                  active={selectedCategoryId === cat.id}
                  onPress={() =>
                    setSelectedCategoryId(selectedCategoryId === cat.id ? undefined : cat.id)
                  }
                />
              ))}
            </View>
          </ScrollView>

          <View style={styles.subFilterRow}>
            <View style={styles.subGroup}>
              <Text style={styles.subLabel}>Kích cỡ</Text>
              <View style={styles.chipRow}>
                {SIZES.map((sz) => (
                  <FilterChip
                    key={sz}
                    label={sz}
                    active={selectedSize === sz}
                    onPress={() => setSelectedSize(selectedSize === sz ? undefined : sz)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.subGroup}>
              <Text style={styles.subLabel}>Màu sắc</Text>
              <View style={styles.chipRow}>
                {COLORS.map((clr) => (
                  <FilterChip
                    key={clr}
                    label={clr}
                    swatch={resolveColorSwatch(clr)}
                    active={selectedColor === clr}
                    onPress={() => setSelectedColor(selectedColor === clr ? undefined : clr)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.subGroup}>
              <Text style={styles.subLabel}>Sắp xếp</Text>
              <View style={styles.chipRow}>
                {SORT_OPTIONS.map((opt) => (
                  <FilterChip
                    key={opt.value}
                    label={opt.label}
                    active={sort === opt.value}
                    onPress={() => setSort(opt.value)}
                  />
                ))}
              </View>
            </View>
          </View>
        </View>
      </FadeSlideIn>

      <View style={styles.resultHeader}>
        <Text style={styles.resultCount}>
          {loading ? 'Đang tải danh mục sản phẩm...' : `${total} sản phẩm đang mở bán`}
        </Text>
      </View>

      {/* Shimmer Skeleton Grid / Error / Empty / Animated Interactive Cards */}
      {loading && products.length === 0 ? (
        <View style={styles.grid}>
          {[0, 1, 2].map((idx) => {
            const cardWidthPercent =
              columns === 3 ? '32.2%' : columns === 2 ? '48.8%' : '100%';
            return (
              <View key={idx} style={[styles.skeletonCard, shadows.soft, { width: cardWidthPercent }]}>
                <ShimmerBlock height={210} borderRadius={radius.md} />
                <ShimmerBlock height={18} width="75%" borderRadius={radius.pill} />
                <ShimmerBlock height={14} width="45%" borderRadius={radius.pill} />
              </View>
            );
          })}
        </View>
      ) : error && products.length === 0 ? (
        <StateCard
          kind="error"
          title="Không thể tải catalog"
          message={error}
          actionLabel="Thử lại"
          onAction={() => void fetchProducts(1, false)}
        />
      ) : products.length === 0 ? (
        <StateCard
          kind="empty"
          title="Không có sản phẩm phù hợp"
          message="Hãy điều chỉnh từ khóa hoặc xóa bộ lọc hiện tại để xem lại toàn bộ thiết kế."
          actionLabel="Xóa bộ lọc"
          onAction={clearFilters}
        />
      ) : (
        <>
          {error ? (
            <StateCard
              kind="error"
              title="Lỗi làm mới dữ liệu"
              message={error}
              actionLabel="Thử lại"
              onAction={() => void fetchProducts(page, false)}
            />
          ) : null}

          <View style={styles.grid}>
            {products.map((product, idx) => {
              const lowestPrice = getLowestActivePrice(product);
              const totalStock = getTotalActiveStock(product);
              const uniqueColors = Array.from(new Set(product.variants.map((v) => v.color)));
              const cardWidthPercent =
                columns === 3 ? '32.2%' : columns === 2 ? '48.8%' : '100%';

              return (
                <FadeSlideIn
                  key={product.id}
                  delay={Math.min(idx * 45, 240)}
                  distance={16}
                  style={{ width: cardWidthPercent }}
                >
                  <InteractiveCard
                    onPress={() => navigate({ name: 'product', productId: product.id })}
                    style={styles.card}
                    accessibilityLabel={product.name}
                  >
                    <GarmentArtwork
                      uri={product.images[0]?.url}
                      altText={product.images[0]?.altText || product.name}
                      height={216}
                    />
                    <View style={styles.cardBody}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {product.name}
                      </Text>
                      <View style={styles.cardMetaRow}>
                        <Text style={styles.cardPrice}>{formatVnd(lowestPrice)}</Text>
                        <View
                          style={[
                            styles.stockPill,
                            totalStock === 0 && { backgroundColor: colors.dangerSoft },
                          ]}
                        >
                          <Text
                            style={[
                              styles.cardStock,
                              totalStock === 0 && { color: colors.danger },
                            ]}
                          >
                            {totalStock > 0 ? `Còn ${totalStock}` : 'Tạm hết hàng'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.swatchRow}>
                        {uniqueColors.map((clr) => (
                          <View key={clr} style={styles.swatchItem}>
                            <View
                              style={[
                                styles.swatchDot,
                                { backgroundColor: resolveColorSwatch(clr) },
                              ]}
                            />
                            <Text style={styles.swatchText}>{clr}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </InteractiveCard>
                </FadeSlideIn>
              );
            })}
          </View>

          {products.length < total ? (
            <View style={styles.loadMoreWrap}>
              <EditorialButton
                label={loadingMore ? 'Đang tải thêm...' : `Tải thêm (${products.length}/${total})`}
                variant="secondary"
                loading={loadingMore}
                onPress={() => void fetchProducts(page + 1, true)}
              />
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

/** Pill-shaped filter chip with hover tint and optional color swatch dot. */
function FilterChip({
  label,
  active,
  swatch,
  onPress,
}: {
  label: string;
  active: boolean;
  swatch?: string;
  onPress: () => void;
}): React.ReactElement {
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[
        styles.chip,
        hovered && !active && styles.chipHovered,
        active && styles.chipActive,
      ]}
      accessibilityRole="button"
    >
      {swatch ? <View style={[styles.swatchDot, { backgroundColor: swatch }]} /> : null}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    padding: spacing.lg,
    maxWidth: 1180,
    width: '100%',
    alignSelf: 'center',
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  hero: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    flexDirection: 'row',
    gap: spacing.xl,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  heroGlowRight: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    top: -140,
    right: -80,
    opacity: 0.7,
  },
  heroGlowBottom: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: colors.warmHighlight,
    bottom: -120,
    left: 40,
    opacity: 0.65,
  },
  heroCopy: {
    flex: 1.4,
    gap: spacing.md,
    zIndex: 2,
  },
  heroVisual: {
    flex: 1,
    zIndex: 2,
  },
  heroTitle: {
    fontFamily: typography.serif,
    fontSize: 30,
    lineHeight: 38,
    color: colors.ink,
  },
  heroSubtitle: {
    fontFamily: typography.sans,
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
    maxWidth: 560,
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  filterPanel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    fontFamily: typography.sans,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.surfaceSoft,
  },
  chipScroll: {
    flexGrow: 0,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipHovered: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.borderStrong,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  chipText: {
    fontFamily: typography.sans,
    fontSize: 13,
    color: colors.ink,
  },
  chipTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  subFilterRow: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  subGroup: {
    gap: 6,
  },
  subLabel: {
    fontFamily: typography.sans,
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  resultCount: {
    fontFamily: typography.sans,
    fontSize: 13,
    fontWeight: '500',
    color: colors.muted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  skeletonCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    flex: 1,
  },
  cardBody: {
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
  },
  cardTitle: {
    fontFamily: typography.serif,
    fontSize: 17,
    color: colors.ink,
  },
  cardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardPrice: {
    fontFamily: typography.sans,
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  stockPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
  },
  cardStock: {
    fontFamily: typography.sans,
    fontSize: 12,
    fontWeight: '500',
    color: colors.muted,
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 4,
  },
  swatchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  swatchDot: {
    width: 11,
    height: 11,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  swatchText: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.muted,
  },
  loadMoreWrap: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
});
