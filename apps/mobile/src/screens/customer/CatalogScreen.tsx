import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  ViewStyle,
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

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/**
 * Customer storefront screen with breathable editorial hero, active-filter pills,
 * and a collapsible right-hand search & filter sidebar (docked on desktop, slide-over drawer on mobile).
 */
export function CatalogScreen(): React.ReactElement {
  const { navigate, handleApiError } = useApp();
  const { width } = useWindowDimensions();

  const isDesktop = width >= 920;

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

  // Default open on wide screens so the right sidebar is immediately accessible, closed on compact screens.
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(width >= 920);

  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Smooth horizontal entrance animation for the right sidebar.
  const sidebarAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(sidebarAnim, {
      toValue: sidebarOpen ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [sidebarAnim, sidebarOpen]);

  /** Load ACTIVE categories for filter chips. */
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

  const activeFilterCount =
    (appliedQ ? 1 : 0) +
    (selectedCategoryId ? 1 : 0) +
    (selectedSize ? 1 : 0) +
    (selectedColor ? 1 : 0) +
    (sort !== 'NEWEST' ? 1 : 0);

  // Reflow grid columns smoothly depending on screen width and whether right sidebar is open.
  const columns = isDesktop
    ? sidebarOpen
      ? width >= 1140
        ? 3
        : 2
      : 3
    : width >= 620
      ? 2
      : 1;

  const selectedCategoryName = categories.find((c) => c.id === selectedCategoryId)?.name;

  /** Reusable search & filter sidebar content shared by Desktop right rail and Mobile right drawer. */
  const renderFilterSidebarContent = () => (
    <View style={styles.sidebarBody}>
      <View style={styles.sidebarHeader}>
        <View style={styles.sidebarTitleRow}>
          <Text style={styles.sidebarTitle}>Tìm kiếm & Bộ lọc</Text>
          {activeFilterCount > 0 ? (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </View>
        <Pressable
          onPress={() => setSidebarOpen(false)}
          style={styles.closeSidebarBtn}
          accessibilityRole="button"
          accessibilityLabel="Đóng thanh tìm kiếm"
        >
          <Text style={styles.closeSidebarText}>Thu gọn ✕</Text>
        </Pressable>
      </View>

      {/* Search input with clear & submit */}
      <View style={styles.sidebarSection}>
        <Text style={styles.subLabel}>Từ khóa sản phẩm / SKU</Text>
        <View style={styles.searchInputWrap}>
          <TextInput
            value={searchInput}
            onChangeText={setSearchInput}
            onSubmitEditing={() => setAppliedQ(searchInput.trim())}
            placeholder="Áo linen, denim, SKU..."
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {searchInput.length > 0 ? (
            <Pressable
              onPress={() => {
                setSearchInput('');
                setAppliedQ('');
              }}
              style={styles.clearInputBtn}
            >
              <Text style={styles.clearInputText}>✕</Text>
            </Pressable>
          ) : null}
        </View>
        <EditorialButton
          label="Áp dụng tìm kiếm"
          compact
          onPress={() => setAppliedQ(searchInput.trim())}
        />
      </View>

      {/* Category pills */}
      <View style={styles.sidebarSection}>
        <Text style={styles.subLabel}>Danh mục</Text>
        <View style={styles.chipRow}>
          <FilterChip
            label="Tất cả"
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
      </View>

      {/* Size pills */}
      <View style={styles.sidebarSection}>
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

      {/* Color swatches */}
      <View style={styles.sidebarSection}>
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

      {/* Sort options */}
      <View style={styles.sidebarSection}>
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

      {activeFilterCount > 0 ? (
        <EditorialButton
          label="Xóa tất cả bộ lọc"
          variant="secondary"
          compact
          onPress={clearFilters}
        />
      ) : null}
    </View>
  );

  return (
    <View style={styles.pageRoot}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Compact breathable lookbook hero keeping catalog visible above the fold */}
        <FadeSlideIn distance={14} duration={380}>
          <View style={[styles.hero, shadows.card]}>
            <View style={styles.heroGlowRight} />
            <View style={styles.heroGlowBottom} />

            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Sợi tự nhiên & Phom dáng kiến trúc</Text>
              <Text style={styles.heroSubtitle}>
                Thiết kế may mặc thường nhật từ linen, cotton 260gsm và len merino. Thanh toán COD
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
                    height={168}
                  />
                </View>
              </FloatingAmbient>
            ) : null}
          </View>
        </FadeSlideIn>

        {/* Main split workspace: Catalog grid on left + Collapsible Search Sidebar on right */}
        <View style={[styles.workspaceRow, isDesktop && styles.workspaceRowDesktop]}>
          {/* Left/Main Product Column */}
          <View style={styles.catalogColumn}>
            {/* Toolbar with product count, active filter summary pills, and right-aligned Toggle Button */}
            <View style={[styles.toolbarCard, shadows.soft]}>
              <View style={styles.toolbarTop}>
                <View style={styles.toolbarMeta}>
                  <Text style={styles.resultCount}>
                    {loading ? 'Đang tải danh mục sản phẩm...' : `${total} sản phẩm đang mở bán`}
                  </Text>
                </View>

                <Pressable
                  onPress={() => setSidebarOpen((open) => !open)}
                  style={[styles.toggleSidebarBtn, sidebarOpen && styles.toggleSidebarBtnActive]}
                  accessibilityRole="button"
                  accessibilityLabel={sidebarOpen ? 'Ẩn thanh tìm kiếm' : 'Mở thanh tìm kiếm'}
                >
                  <Text
                    style={[
                      styles.toggleSidebarText,
                      sidebarOpen && styles.toggleSidebarTextActive,
                    ]}
                  >
                    {sidebarOpen ? 'Ẩn bộ lọc' : 'Tìm kiếm & Lọc'}
                    {!sidebarOpen && activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                  </Text>
                </Pressable>
              </View>

              {/* Active Filter Summary Chips (dismissible even when sidebar is closed) */}
              {activeFilterCount > 0 ? (
                <View style={styles.activeFilterRow}>
                  {appliedQ ? (
                    <ActiveFilterTag
                      label={`Từ khóa: "${appliedQ}"`}
                      onRemove={() => {
                        setSearchInput('');
                        setAppliedQ('');
                      }}
                    />
                  ) : null}
                  {selectedCategoryName ? (
                    <ActiveFilterTag
                      label={`Danh mục: ${selectedCategoryName}`}
                      onRemove={() => setSelectedCategoryId(undefined)}
                    />
                  ) : null}
                  {selectedSize ? (
                    <ActiveFilterTag
                      label={`Size: ${selectedSize}`}
                      onRemove={() => setSelectedSize(undefined)}
                    />
                  ) : null}
                  {selectedColor ? (
                    <ActiveFilterTag
                      label={`Màu: ${selectedColor}`}
                      onRemove={() => setSelectedColor(undefined)}
                    />
                  ) : null}
                  {sort !== 'NEWEST' ? (
                    <ActiveFilterTag
                      label={`Xếp: ${SORT_OPTIONS.find((s) => s.value === sort)?.label ?? sort}`}
                      onRemove={() => setSort('NEWEST')}
                    />
                  ) : null}
                </View>
              ) : null}
            </View>

            {/* Product Grid / Shimmer Skeleton / Empty / Error */}
            {loading && products.length === 0 ? (
              <View style={styles.grid}>
                {[0, 1, 2].map((idx) => {
                  const cardWidthPercent =
                    columns === 3 ? '31.8%' : columns === 2 ? '48.5%' : '100%';
                  return (
                    <View
                      key={idx}
                      style={[styles.skeletonCard, shadows.soft, { width: cardWidthPercent }]}
                    >
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
                      columns === 3 ? '31.8%' : columns === 2 ? '48.5%' : '100%';

                    return (
                      <FadeSlideIn
                        key={product.id}
                        delay={Math.min(idx * 45, 220)}
                        distance={14}
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
                            height={212}
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
                      label={
                        loadingMore ? 'Đang tải thêm...' : `Tải thêm (${products.length}/${total})`
                      }
                      variant="secondary"
                      loading={loadingMore}
                      onPress={() => void fetchProducts(page + 1, true)}
                    />
                  </View>
                ) : null}
              </>
            )}
          </View>

          {/* Desktop Right-Hand Collapsible Sticky Sidebar */}
          {isDesktop && sidebarOpen ? (
            <Animated.View
              style={[
                styles.desktopSidebar,
                shadows.card,
                {
                  opacity: sidebarAnim,
                  transform: [
                    {
                      translateX: sidebarAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [24, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              {renderFilterSidebarContent()}
            </Animated.View>
          ) : null}
        </View>
      </ScrollView>

      {/* Mobile/Tablet Right Slide-Over Drawer Modal when user opens filter on narrow screens */}
      {!isDesktop ? (
        <Modal
          visible={sidebarOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setSidebarOpen(false)}
        >
          <View style={styles.drawerOverlay}>
            <Pressable style={styles.drawerBackdrop} onPress={() => setSidebarOpen(false)} />
            <FadeSlideIn distance={20} duration={240} style={[styles.mobileDrawer, shadows.lifted]}>
              <ScrollView showsVerticalScrollIndicator={false}>
                {renderFilterSidebarContent()}
              </ScrollView>
            </FadeSlideIn>
          </View>
        </Modal>
      ) : null}
    </View>
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

/** Removable active filter summary pill shown above the product grid. */
function ActiveFilterTag({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}): React.ReactElement {
  return (
    <Pressable onPress={onRemove} style={styles.activeTag}>
      <Text style={styles.activeTagText}>{label} ✕</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pageRoot: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    padding: spacing.lg,
    maxWidth: 1240,
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
    width: 300,
    height: 300,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    top: -130,
    right: -70,
    opacity: 0.72,
  },
  heroGlowBottom: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 999,
    backgroundColor: colors.warmHighlight,
    bottom: -110,
    left: 40,
    opacity: 0.65,
  },
  heroCopy: {
    flex: 1.5,
    gap: spacing.sm,
    zIndex: 2,
  },
  heroVisual: {
    flex: 0.9,
    zIndex: 2,
  },
  heroTitle: {
    fontFamily: typography.serif,
    fontSize: 28,
    lineHeight: 35,
    color: colors.ink,
  },
  heroSubtitle: {
    fontFamily: typography.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    maxWidth: 560,
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  workspaceRow: {
    gap: spacing.lg,
  },
  workspaceRowDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  catalogColumn: {
    flex: 1,
    gap: spacing.lg,
    minWidth: 0,
  },
  toolbarCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  toolbarTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  toolbarMeta: {
    flex: 1,
  },
  resultCount: {
    fontFamily: typography.sans,
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  toggleSidebarBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  toggleSidebarBtnActive: {
    backgroundColor: colors.accentSoft,
  },
  toggleSidebarText: {
    fontFamily: typography.sans,
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  toggleSidebarTextActive: {
    color: colors.accent,
  },
  activeFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  activeTag: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: '#CFDAEC',
  },
  activeTagText: {
    fontFamily: typography.sans,
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  desktopSidebar: {
    width: 312,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...(Platform.OS === 'web'
      ? ({ position: 'sticky', top: 82 } as unknown as ViewStyle)
      : {}),
  },
  sidebarBody: {
    gap: spacing.md,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sidebarTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sidebarTitle: {
    fontFamily: typography.serif,
    fontSize: 18,
    color: colors.ink,
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 99,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countBadgeText: {
    fontFamily: typography.sans,
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeSidebarBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  closeSidebarText: {
    fontFamily: typography.sans,
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  sidebarSection: {
    gap: spacing.xs,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  searchInput: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingRight: 34,
    fontFamily: typography.sans,
    fontSize: 13,
    color: colors.ink,
    backgroundColor: colors.surfaceSoft,
  },
  clearInputBtn: {
    position: 'absolute',
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearInputText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
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
    fontSize: 12,
    color: colors.ink,
  },
  chipTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  subLabel: {
    fontFamily: typography.sans,
    fontSize: 12,
    fontWeight: '700',
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
    fontSize: 16,
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
    width: 10,
    height: 10,
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
  drawerOverlay: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  drawerBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(23, 22, 27, 0.36)',
  },
  mobileDrawer: {
    width: '86%',
    maxWidth: 340,
    height: '100%',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
  },
});
