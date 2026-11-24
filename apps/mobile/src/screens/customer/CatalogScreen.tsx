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
} from 'react-native';
import { fashionApi } from '../../api/client';
import {
  FadeSlideIn,
  FloatingAmbient,
  InteractiveCard,
  ShimmerBlock,
} from '../../components/Motion';
import { QuickViewModal } from '../../components/QuickViewModal';
import { EditorialButton, GarmentArtwork, StateCard } from '../../components/UiPrimitives';
import { VoucherStrip } from '../../components/VoucherStrip';
import { useApp } from '../../state/AppContext';
import {
  colors,
  radius,
  resolveColorSwatch,
  shadows,
  spacing,
  typography,
} from '../../theme/tokens';
import { ApiClientError, Category, EntityId, Product, ProductSort } from '../../types/api';
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
 * Full-screen Fashion Storefront supporting:
 * - "home" (Trang chủ) & "products" (Sản phẩm) views
 * - Horizontal carousels with left/right ‹ › scroll buttons for Categories, Vouchers, and Best Sellers
 * - Centered scaling Hover Action icons on each product card
 * - Sticky right-edge reopen handle whenever the Search/Filter sidebar is collapsed
 */
export function CatalogScreen({
  viewMode = 'home',
  externalSearch,
}: {
  viewMode?: 'home' | 'products';
  externalSearch?: { q: string; nonce: number } | null;
}): React.ReactElement {
  const { user, navigate, refreshCart, handleApiError, showToast } = useApp();
  const { width } = useWindowDimensions();

  const isDesktop = width >= 920;

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [allActiveProducts, setAllActiveProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const pageSize = 8;

  const [searchInput, setSearchInput] = useState<string>('');
  const [appliedQ, setAppliedQ] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<EntityId | undefined>(undefined);
  const [selectedSize, setSelectedSize] = useState<string | undefined>(undefined);
  const [selectedColor, setSelectedColor] = useState<string | undefined>(undefined);
  const [sort, setSort] = useState<ProductSort>('NEWEST');

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(width >= 920);
  const [quickAddBusyId, setQuickAddBusyId] = useState<EntityId | null>(null);
  const [quickViewState, setQuickViewState] = useState<{
    product: Product;
    color?: string;
  } | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Horizontal carousel scroll refs & offsets
  const catScrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const catScrollX = useRef<number>(0);
  const bestScrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const bestScrollX = useRef<number>(0);

  useEffect(() => {
    if (externalSearch) {
      setSearchInput(externalSearch.q);
      setAppliedQ(externalSearch.q);
    }
  }, [externalSearch]);

  const sidebarAnim = useRef(new Animated.Value(sidebarOpen ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(sidebarAnim, {
      toValue: sidebarOpen ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [sidebarAnim, sidebarOpen]);

  /** Load ACTIVE categories and baseline active catalog for category counts & spotlight carousel. */
  const fetchCategoriesAndSpotlight = useCallback(async () => {
    try {
      const [catList, fullPage] = await Promise.all([
        fashionApi.listCategories(),
        fashionApi.listProducts({ page: 1, pageSize: 50, sort: 'NEWEST' }),
      ]);
      setCategories(catList);
      setAllActiveProducts(fullPage.items);
    } catch {
      // Non-blocking: main grid handles retry.
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
    void fetchCategoriesAndSpotlight();
  }, [fetchCategoriesAndSpotlight]);

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

  /** Add first in-stock variant matching optional preferredColor directly to Customer cart. */
  const handleQuickAddToCart = async (product: Product, preferredColor?: string) => {
    const colorMatch = preferredColor
      ? product.variants.find(
          (v) => v.status === 'ACTIVE' && v.color === preferredColor && v.stockQuantity > 0,
        )
      : undefined;
    const firstAvailable =
      colorMatch ?? product.variants.find((v) => v.status === 'ACTIVE' && v.stockQuantity > 0);
    if (!firstAvailable) {
      navigate({ name: 'product', productId: product.id, initialColor: preferredColor });
      return;
    }
    if (!user) {
      showToast('info', 'Vui lòng đăng nhập Customer để thêm sản phẩm vào giỏ hàng.');
      navigate({ name: 'auth', mode: 'login' });
      return;
    }
    if (user.role !== 'CUSTOMER') {
      showToast('error', 'Tài khoản Quản trị/Nhân viên không dùng giỏ hàng.');
      return;
    }

    setQuickAddBusyId(product.id);
    try {
      await fashionApi.addCartItem({ variantId: firstAvailable.id, quantity: 1 });
      await refreshCart();
      showToast(
        'success',
        `Đã thêm ${product.name} (${firstAvailable.size}/${firstAvailable.color}) vào giỏ.`,
      );
    } catch (err) {
      showToast('error', handleApiError(err));
      if (err instanceof ApiClientError && err.code === 'OUT_OF_STOCK') {
        await fetchProducts(1, false);
      }
    } finally {
      setQuickAddBusyId(null);
    }
  };

  /** Scroll a horizontal ScrollView smoothly by a pixel delta. */
  const scrollHorizontal = (
    ref: React.RefObject<React.ComponentRef<typeof ScrollView> | null>,
    xTracker: React.MutableRefObject<number>,
    delta: number,
  ) => {
    const nextX = Math.max(0, xTracker.current + delta);
    xTracker.current = nextX;
    ref.current?.scrollTo({ x: nextX, animated: true });
  };

  const activeFilterCount =
    (appliedQ ? 1 : 0) +
    (selectedCategoryId ? 1 : 0) +
    (selectedSize ? 1 : 0) +
    (selectedColor ? 1 : 0) +
    (sort !== 'NEWEST' ? 1 : 0);

  const columns = isDesktop
    ? sidebarOpen
      ? width >= 1380
        ? 4
        : width >= 1060
          ? 3
          : 2
      : width >= 1280
        ? 4
        : 3
    : width >= 620
      ? 2
      : 1;

  const cardWidthPercent: `${number}%` =
    columns === 4 ? '23.8%' : columns === 3 ? '32.2%' : columns === 2 ? '48.8%' : '100%';

  const selectedCategoryName = categories.find((c) => c.id === selectedCategoryId)?.name;

  /** Bean Farm styled right-hand sidebar with emerald headers ("DANH MỤC SẢN PHẨM" & "BỘ LỌC SẢN PHẨM"). */
  const renderFilterSidebarContent = () => (
    <View style={styles.sidebarBody}>
      <View style={styles.sidebarTopBar}>
        <View style={styles.sidebarTitleRow}>
          <Text style={styles.sidebarMainHeading}>Bộ lọc & Tìm kiếm</Text>
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

      {/* Card 1: DANH MỤC SẢN PHẨM */}
      <View style={styles.sidebarBox}>
        <View style={styles.sidebarBoxHeader}>
          <Text style={styles.sidebarBoxHeaderText}>DANH MỤC SẢN PHẨM</Text>
        </View>
        <View style={styles.sidebarBoxContent}>
          <Pressable
            onPress={() => setSelectedCategoryId(undefined)}
            style={[styles.catTreeRow, !selectedCategoryId && styles.catTreeRowActive]}
          >
            <Text style={[styles.catTreeText, !selectedCategoryId && styles.catTreeTextActive]}>
              Tất cả thiết kế
            </Text>
            <Text style={styles.catTreePlus}>+</Text>
          </Pressable>
          {categories.map((cat) => {
            const active = selectedCategoryId === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => setSelectedCategoryId(active ? undefined : cat.id)}
                style={[styles.catTreeRow, active && styles.catTreeRowActive]}
              >
                <Text style={[styles.catTreeText, active && styles.catTreeTextActive]}>
                  {cat.name}
                </Text>
                <Text style={[styles.catTreePlus, active && { color: colors.accent }]}>
                  {active ? '−' : '+'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Card 2: BỘ LỌC SẢN PHẨM */}
      <View style={styles.sidebarBox}>
        <View style={styles.sidebarBoxHeader}>
          <Text style={styles.sidebarBoxHeaderText}>BỘ LỌC SẢN PHẨM</Text>
        </View>
        <View style={styles.sidebarBoxContent}>
          <Text style={styles.subLabel}>TÌM THEO TÊN HOẶC SKU</Text>
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
            label="Tìm sản phẩm"
            compact
            onPress={() => setAppliedQ(searchInput.trim())}
          />

          <View style={styles.sidebarDivider} />
          <Text style={styles.subLabel}>CHỌN KÍCH CỠ</Text>
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

          <View style={styles.sidebarDivider} />
          <Text style={styles.subLabel}>CHỌN MÀU SẮC</Text>
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

          <View style={styles.sidebarDivider} />
          <Text style={styles.subLabel}>SẮP XẾP</Text>
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

          {activeFilterCount > 0 ? (
            <EditorialButton
              label="Xóa tất cả bộ lọc"
              variant="secondary"
              compact
              onPress={clearFilters}
              style={{ marginTop: spacing.xs }}
            />
          ) : null}
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.pageRoot, isDesktop && styles.pageRootDesktop]}>
      {/* Left/Main Full-Screen Scrollable Storefront */}
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {viewMode === 'products' ? (
          /* Dedicated "Sản phẩm" Page Banner */
          <FadeSlideIn distance={12} duration={340}>
            <View style={[styles.productsBanner, shadows.card]}>
              <Text style={styles.productsBannerTitle}>
                {selectedCategoryName ? selectedCategoryName : 'Tất cả sản phẩm'}
              </Text>
              <View style={styles.breadcrumbBar}>
                <Pressable onPress={() => navigate({ name: 'catalog', view: 'home' })}>
                  <Text style={styles.breadcrumbLink}>Trang chủ</Text>
                </Pressable>
                <Text style={styles.breadcrumbSep}>›</Text>
                <Text style={styles.breadcrumbCurrent}>
                  {selectedCategoryName ? selectedCategoryName : 'Tất cả sản phẩm'}
                </Text>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.circleCatRow}>
                  <Pressable
                    onPress={() => setSelectedCategoryId(undefined)}
                    style={styles.circleCatItem}
                  >
                    <View
                      style={[
                        styles.circleCatRing,
                        !selectedCategoryId && styles.circleCatRingActive,
                      ]}
                    >
                      <Text style={styles.circleCatAll}>ALL</Text>
                    </View>
                    <Text style={styles.circleCatLabel}>Tất cả</Text>
                  </Pressable>
                  {categories.map((cat) => {
                    const catProducts = allActiveProducts.filter((p) => p.categoryId === cat.id);
                    const repImage = catProducts[0]?.images[0]?.url;
                    const active = selectedCategoryId === cat.id;
                    return (
                      <Pressable
                        key={cat.id}
                        onPress={() => setSelectedCategoryId(active ? undefined : cat.id)}
                        style={styles.circleCatItem}
                      >
                        <View style={[styles.circleCatRing, active && styles.circleCatRingActive]}>
                          <GarmentArtwork
                            uri={repImage}
                            altText={cat.name}
                            height={72}
                            hideCaption
                          />
                        </View>
                        <Text style={styles.circleCatLabel} numberOfLines={1}>
                          {cat.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </FadeSlideIn>
        ) : (
          /* "Trang chủ" Mint Promotional Hero Banner + Danh mục nổi bật carousel */
          <>
            <FadeSlideIn distance={14} duration={360}>
              <View style={[styles.mintHero, shadows.card]}>
                <View style={styles.mintCircleBg} />
                <View style={styles.mintHeroCopy}>
                  <Text style={styles.mintHeroTitle}>
                    Thời Trang Tự Nhiên{'\n'}Chuẩn Phom Hàng Ngày
                  </Text>
                  <Text style={styles.mintHeroSubtitle}>
                    Miễn phí giao hàng toàn quốc đơn COD mô phỏng. Chất liệu linen, cotton 260gsm và
                    len merino chọn lọc.
                  </Text>
                  <View style={styles.heroActions}>
                    <EditorialButton
                      label="ĐẶT NGAY"
                      onPress={() => navigate({ name: 'catalog', view: 'products' })}
                    />
                    <EditorialButton
                      label="Đơn hàng của tôi"
                      variant="secondary"
                      onPress={() => navigate({ name: 'orders' })}
                    />
                  </View>
                </View>

                {width >= 720 ? (
                  <FloatingAmbient style={styles.mintHeroVisual}>
                    <View style={shadows.lifted}>
                      <GarmentArtwork
                        uri="garment://%231E3A5F/coat/S%E1%BB%9EI%20Lookbook"
                        altText="Bộ sưu tập Sợi Fashion"
                        height={215}
                      />
                    </View>
                  </FloatingAmbient>
                ) : null}
              </View>
            </FadeSlideIn>

            {categories.length > 0 ? (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeading}>Danh mục nổi bật</Text>
                  <View style={styles.carouselHeaderRight}>
                    <Pressable onPress={() => navigate({ name: 'catalog', view: 'products' })}>
                      <Text style={styles.sectionLink}>Xem tất cả</Text>
                    </Pressable>
                    <View style={styles.arrowGroup}>
                      <Pressable
                        onPress={() => scrollHorizontal(catScrollRef, catScrollX, -280)}
                        style={styles.arrowBtn}
                        accessibilityLabel="Danh mục trước"
                      >
                        <Text style={styles.arrowText}>‹</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => scrollHorizontal(catScrollRef, catScrollX, 280)}
                        style={styles.arrowBtn}
                        accessibilityLabel="Danh mục tiếp"
                      >
                        <Text style={styles.arrowText}>›</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
                <ScrollView
                  ref={catScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  scrollEventThrottle={16}
                  onScroll={(e) => {
                    catScrollX.current = e.nativeEvent.contentOffset.x;
                  }}
                >
                  <View style={styles.catStripRow}>
                    {categories.map((cat) => {
                      const catProducts = allActiveProducts.filter((p) => p.categoryId === cat.id);
                      const repImage = catProducts[0]?.images[0]?.url;
                      const active = selectedCategoryId === cat.id;
                      return (
                        <Pressable
                          key={cat.id}
                          onPress={() => setSelectedCategoryId(active ? undefined : cat.id)}
                          style={[
                            styles.catSpotlightCard,
                            shadows.soft,
                            active && styles.catSpotlightActive,
                          ]}
                        >
                          <GarmentArtwork
                            uri={repImage}
                            altText={cat.name}
                            height={110}
                            hideCaption
                          />
                          <Text style={styles.catSpotlightTitle} numberOfLines={1}>
                            {cat.name}
                          </Text>
                          <Text style={styles.catSpotlightCount}>{catProducts.length} sản phẩm</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            ) : null}
          </>
        )}

        {/* Voucher Ticket Strip */}
        <VoucherStrip />

        {/* "Bán chạy nhất hàng ngày" Interactive Horizontal Carousel across all active models */}
        {viewMode === 'home' && allActiveProducts.length > 0 && activeFilterCount === 0 ? (
          <View style={[styles.bestSellerPanel, shadows.card]}>
            <View style={styles.bestSellerPromo}>
              <Text style={styles.promoHeadline}>Bán chạy nhất hàng ngày</Text>
              <Text style={styles.promoSub}>
                Ưu đãi độc quyền - Giá tốt từ 290.000₫. Lướt xem {allActiveProducts.length} mẫu thiết
                kế nổi bật.
              </Text>
              <Pressable
                onPress={() => navigate({ name: 'catalog', view: 'products' })}
                style={styles.promoWhiteBtn}
              >
                <Text style={styles.promoWhiteBtnText}>Xem tất cả</Text>
              </Pressable>
            </View>

            <View style={styles.bestSellerCarouselCol}>
              <View style={styles.bestSellerNavRow}>
                <Text style={styles.bestSellerNavHint}>
                  Lướt qua các mẫu ({allActiveProducts.length} sản phẩm)
                </Text>
                <View style={styles.arrowGroup}>
                  <Pressable
                    onPress={() => scrollHorizontal(bestScrollRef, bestScrollX, -320)}
                    style={styles.arrowBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Mẫu bán chạy trước"
                  >
                    <Text style={styles.arrowText}>‹</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => scrollHorizontal(bestScrollRef, bestScrollX, 320)}
                    style={styles.arrowBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Mẫu bán chạy tiếp theo"
                  >
                    <Text style={styles.arrowText}>›</Text>
                  </Pressable>
                </View>
              </View>

              <ScrollView
                ref={bestScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={(e) => {
                  bestScrollX.current = e.nativeEvent.contentOffset.x;
                }}
              >
                <View style={styles.bestSellerScrollRow}>
                  {allActiveProducts.map((prod) => (
                    <ProductPortraitCard
                      key={`best-${prod.id}`}
                      product={prod}
                      cardStyle={styles.carouselItemCard}
                      badgeText="Bán chạy"
                      badgeColor={colors.amber}
                      badgeTextColor={colors.amberInk}
                      busy={quickAddBusyId === prod.id}
                      onOpenDetail={(color) =>
                        navigate({ name: 'product', productId: prod.id, initialColor: color })
                      }
                      onQuickView={(color) => setQuickViewState({ product: prod, color })}
                      onQuickAdd={(color) => void handleQuickAddToCart(prod, color)}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        ) : null}

        {/* "TẤT CẢ SẢN PHẨM" Toolbar & Active Filters */}
        <View style={[styles.toolbarCard, shadows.soft]}>
          <View style={styles.toolbarTop}>
            <View style={styles.toolbarMeta}>
              <Text style={styles.allProductsTitle}>TẤT CẢ SẢN PHẨM</Text>
              <Text style={styles.resultCount}>
                {loading ? 'Đang tải...' : `${total} sản phẩm đang mở bán`}
              </Text>
            </View>

            <View style={styles.toolbarRightActions}>
              <Pressable
                onPress={() => setSidebarOpen((open) => !open)}
                style={[styles.toggleSidebarBtn, sidebarOpen && styles.toggleSidebarBtnActive]}
                accessibilityRole="button"
                accessibilityLabel={sidebarOpen ? 'Ẩn thanh tìm kiếm' : 'Mở thanh tìm kiếm'}
              >
                <Text style={styles.toggleSidebarText}>
                  {sidebarOpen ? 'Ẩn bộ lọc' : 'Tìm kiếm & Lọc'}
                  {!sidebarOpen && activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </Text>
              </Pressable>
            </View>
          </View>

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

        {/* Main Tall 3:4 Rectangular Portrait Product Grid */}
        {loading && products.length === 0 ? (
          <View style={styles.grid}>
            {[0, 1, 2].map((idx) => (
              <View
                key={idx}
                style={[styles.skeletonCard, shadows.soft, { width: cardWidthPercent }]}
              >
                <ShimmerBlock height={320} borderRadius={radius.md} />
                <ShimmerBlock height={18} width="75%" borderRadius={radius.pill} />
                <ShimmerBlock height={14} width="45%" borderRadius={radius.pill} />
              </View>
            ))}
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
                const totalStock = getTotalActiveStock(product);
                const badgeText =
                  totalStock === 0
                    ? 'Hết hàng'
                    : totalStock <= 3
                      ? `Còn ${totalStock}`
                      : undefined;
                return (
                  <FadeSlideIn
                    key={product.id}
                    delay={Math.min(idx * 40, 200)}
                    distance={14}
                    style={{ width: cardWidthPercent }}
                  >
                    <ProductPortraitCard
                      product={product}
                      cardStyle={{ width: '100%' }}
                      badgeText={badgeText}
                      badgeColor={colors.coralRed}
                      badgeTextColor="#FFFFFF"
                      busy={quickAddBusyId === product.id}
                      onOpenDetail={(color) =>
                        navigate({ name: 'product', productId: product.id, initialColor: color })
                      }
                      onQuickView={(color) => setQuickViewState({ product, color })}
                      onQuickAdd={(color) => void handleQuickAddToCart(product, color)}
                    />
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
      </ScrollView>

      {/* Full-height Docked Right Sidebar on Desktop — flush with header */}
      {isDesktop ? (
        <Animated.View
          style={[
            styles.desktopDockedSidebar,
            {
              width: sidebarAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 324],
              }),
              opacity: sidebarAnim,
              borderLeftWidth: sidebarOpen ? 1 : 0,
            },
          ]}
        >
          {sidebarOpen ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.dockedSidebarScroll}
            >
              {renderFilterSidebarContent()}
            </ScrollView>
          ) : null}
        </Animated.View>
      ) : null}

      {/* Floating Right-Edge Handle Tab when Sidebar is Collapsed — instant reopen from anywhere */}
      {!sidebarOpen ? (
        <Pressable
          onPress={() => setSidebarOpen(true)}
          style={[styles.edgeReopenHandle, shadows.lifted]}
          accessibilityRole="button"
          accessibilityLabel="Mở nhanh thanh bộ lọc"
        >
          <Text style={styles.edgeHandleArrow}>‹</Text>
          <Text style={styles.edgeHandleText}>Bộ lọc</Text>
          {activeFilterCount > 0 ? (
            <View style={styles.edgeHandleBadge}>
              <Text style={styles.edgeHandleBadgeText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}

      {/* Mobile/Tablet Right Slide-Over Drawer Modal */}
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

      {/* Quick View Modal triggered from Hover Overlay */}
      <QuickViewModal
        product={quickViewState?.product ?? null}
        initialColor={quickViewState?.color}
        onClose={() => setQuickViewState(null)}
        onOpenFullDetail={(pid, color) =>
          navigate({ name: 'product', productId: pid, initialColor: color })
        }
        onStockChanged={() => void fetchProducts(1, false)}
      />
    </View>
  );
}

/**
 * Interactive multi-color product card featuring:
 * - Tall 3:4 portrait garment visual updating dynamically by chosen color swatch
 * - Perfectly centered, large scaling Hover Action Toolbar inside the garment frame
 * - Clickable circular color swatches with active ring indicator
 */
function ProductPortraitCard({
  product,
  cardStyle,
  badgeText,
  badgeColor,
  badgeTextColor,
  busy,
  onOpenDetail,
  onQuickView,
  onQuickAdd,
}: {
  product: Product;
  cardStyle?: object;
  badgeText?: string;
  badgeColor: string;
  badgeTextColor: string;
  busy: boolean;
  onOpenDetail: (selectedColor?: string) => void;
  onQuickView: (selectedColor?: string) => void;
  onQuickAdd: (selectedColor?: string) => void;
}): React.ReactElement {
  const uniqueColors = Array.from(new Set(product.variants.map((v) => v.color)));
  const uniqueSizes = Array.from(new Set(product.variants.map((v) => v.size)));
  const [selectedColor, setSelectedColor] = useState<string | undefined>(uniqueColors[0]);
  const [hovered, setHovered] = useState(false);

  const hoverAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(hoverAnim, {
      toValue: hovered ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [hoverAnim, hovered]);

  const colorVariant = selectedColor
    ? product.variants.find((v) => v.color === selectedColor && v.status === 'ACTIVE')
    : undefined;
  const displayPrice = colorVariant ? colorVariant.price : getLowestActivePrice(product);
  const totalStock = getTotalActiveStock(product);

  return (
    <View
      style={[styles.cardWrap, shadows.soft, cardStyle]}
      {...(Platform.OS === 'web'
        ? {
            onMouseEnter: () => setHovered(true),
            onMouseLeave: () => setHovered(false),
          }
        : {})}
    >
      <View style={styles.cardArtContainer}>
        <InteractiveCard
          onPress={() => onOpenDetail(selectedColor)}
          style={styles.card}
          accessibilityLabel={product.name}
        >
          <View style={styles.cardArtWrap}>
            <GarmentArtwork
              uri={product.images[0]?.url}
              altText={product.images[0]?.altText || product.name}
              aspectRatio={3 / 4}
              overrideToneHex={selectedColor ? resolveColorSwatch(selectedColor) : undefined}
            />
            {badgeText ? (
              <View style={[styles.cardBadge, { backgroundColor: badgeColor }]}>
                <Text style={[styles.cardBadgeText, { color: badgeTextColor }]}>{badgeText}</Text>
              </View>
            ) : null}

            <View style={styles.freeshipPill}>
              <Text style={styles.freeshipText}>FREESHIP</Text>
            </View>
          </View>
        </InteractiveCard>

        {/* Centered Large Hover Action Toolbar anchored directly inside garment frame */}
        <Animated.View
          pointerEvents={hovered ? 'auto' : 'none'}
          style={[
            styles.hoverToolbar,
            {
              opacity: hoverAnim,
              transform: [
                {
                  scale: hoverAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <HoverActionCircle
            icon="⚙"
            label={`Tùy chọn ${product.name}`}
            onPress={() => onOpenDetail(selectedColor)}
          />
          <HoverActionCircle
            icon="👁"
            label={`Xem nhanh ${product.name}`}
            onPress={() => onQuickView(selectedColor)}
          />
          <HoverActionCircle
            icon="＋"
            accent
            label={`Thêm nhanh ${product.name}`}
            onPress={() => onQuickAdd(selectedColor)}
          />
        </Animated.View>
      </View>

      {/* Product meta, interactive circular multi-color swatches, price, and emerald pill CTA */}
      <View style={styles.cardBody}>
        <Pressable onPress={() => onOpenDetail(selectedColor)}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {product.name}
          </Text>
        </Pressable>

        <View style={styles.cardSubMetaRow}>
          <Text style={styles.cardSizeSummary}>
            Size {uniqueSizes[0]}–{uniqueSizes[uniqueSizes.length - 1]} ({uniqueSizes.length} size)
          </Text>
          <Text style={styles.cardStockMini}>
            {totalStock > 0 ? `Còn ${totalStock}` : 'Hết hàng'}
          </Text>
        </View>

        <View style={styles.swatchCircleRow}>
          {uniqueColors.slice(0, 4).map((clr) => {
            const active = selectedColor === clr;
            return (
              <Pressable
                key={clr}
                onPress={() => setSelectedColor(clr)}
                onHoverIn={() => setSelectedColor(clr)}
                style={[styles.swatchCircleOuter, active && styles.swatchCircleOuterActive]}
                accessibilityLabel={`Màu ${clr}`}
              >
                <View
                  style={[styles.swatchCircleInner, { backgroundColor: resolveColorSwatch(clr) }]}
                />
              </Pressable>
            );
          })}
          {uniqueColors.length > 4 ? (
            <Text style={styles.moreColorText}>+{uniqueColors.length - 4}</Text>
          ) : null}
          {selectedColor ? <Text style={styles.selectedColorName}>{selectedColor}</Text> : null}
        </View>

        <Text style={styles.cardPrice}>{formatVnd(displayPrice)}</Text>
      </View>

      <EditorialButton
        label={totalStock > 0 ? 'Thêm vào giỏ' : 'Xem chi tiết'}
        onPress={() => (totalStock > 0 ? onQuickAdd(selectedColor) : onOpenDetail(selectedColor))}
        loading={busy}
        compact
        style={styles.cardCtaBtn}
      />
    </View>
  );
}

/** Circular hover action button that scales up smoothly on pointer hover. */
function HoverActionCircle({
  icon,
  label,
  accent = false,
  onPress,
}: {
  icon: string;
  label: string;
  accent?: boolean;
  onPress: () => void;
}): React.ReactElement {
  const scale = useRef(new Animated.Value(1)).current;

  /** Spring enlarge icon on hover. */
  const handleHoverIn = () => {
    Animated.spring(scale, {
      toValue: 1.18,
      friction: 6,
      tension: 200,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  /** Restore resting scale on hover leave. */
  const handleHoverOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 6,
      tension: 200,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onHoverIn={handleHoverIn}
        onHoverOut={handleHoverOut}
        style={[styles.hoverCircleBtn, accent && styles.hoverCircleAccent, shadows.lifted]}
        accessibilityLabel={label}
      >
        <Text style={[styles.hoverIconText, accent && { color: '#FFFFFF' }]}>{icon}</Text>
      </Pressable>
    </Animated.View>
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
    position: 'relative',
  },
  pageRootDesktop: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    padding: spacing.xl,
    width: '100%',
    gap: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  productsBanner: {
    backgroundColor: '#163D29',
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
  },
  productsBannerTitle: {
    fontFamily: typography.serif,
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  breadcrumbBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  breadcrumbLink: {
    fontFamily: typography.sans,
    fontSize: 13,
    color: '#DDF3E8',
    fontWeight: '600',
  },
  breadcrumbSep: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
  breadcrumbCurrent: {
    fontFamily: typography.sans,
    fontSize: 13,
    color: colors.amber,
    fontWeight: '700',
  },
  circleCatRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingTop: spacing.xs,
  },
  circleCatItem: {
    alignItems: 'center',
    gap: 6,
    width: 96,
  },
  circleCatRing: {
    width: 78,
    height: 78,
    borderRadius: 99,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 3,
  },
  circleCatRingActive: {
    borderColor: colors.amber,
  },
  circleCatAll: {
    fontFamily: typography.sans,
    fontSize: 15,
    fontWeight: '800',
    color: colors.accent,
  },
  circleCatLabel: {
    fontFamily: typography.sans,
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  mintHero: {
    backgroundColor: colors.mintHero,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    flexDirection: 'row',
    gap: spacing.xl,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  mintCircleBg: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 999,
    backgroundColor: colors.mintHeroAccent,
    right: -80,
    top: -110,
    opacity: 0.75,
  },
  mintHeroCopy: {
    flex: 1.5,
    gap: spacing.md,
    zIndex: 2,
  },
  mintHeroVisual: {
    width: 195,
    zIndex: 2,
  },
  mintHeroTitle: {
    fontFamily: typography.serif,
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 42,
    color: colors.ink,
  },
  mintHeroSubtitle: {
    fontFamily: typography.sans,
    fontSize: 15,
    lineHeight: 22,
    color: '#3E4C46',
    maxWidth: 620,
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  sectionBlock: {
    gap: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  carouselHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  arrowGroup: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  arrowBtn: {
    width: 34,
    height: 34,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    lineHeight: 20,
  },
  sectionHeading: {
    fontFamily: typography.serif,
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
  },
  sectionLink: {
    fontFamily: typography.sans,
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  catStripRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: 2,
  },
  catSpotlightCard: {
    width: 156,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    alignItems: 'center',
    gap: 6,
  },
  catSpotlightActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  catSpotlightTitle: {
    fontFamily: typography.sans,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  catSpotlightCount: {
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.muted,
  },
  bestSellerPanel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    alignItems: 'stretch',
  },
  bestSellerPromo: {
    width: 240,
    flexGrow: 1,
    backgroundColor: colors.oliveBanner,
    borderRadius: radius.md,
    padding: spacing.xl,
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  promoHeadline: {
    fontFamily: typography.serif,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    color: '#FFFFFF',
  },
  promoSub: {
    fontFamily: typography.sans,
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.9)',
  },
  promoWhiteBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    borderRadius: radius.pill,
  },
  promoWhiteBtnText: {
    fontFamily: typography.sans,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  bestSellerCarouselCol: {
    flex: 3.2,
    minWidth: 280,
    gap: spacing.sm,
  },
  bestSellerNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bestSellerNavHint: {
    fontFamily: typography.sans,
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  bestSellerScrollRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: 2,
  },
  carouselItemCard: {
    width: 256,
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
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  allProductsTitle: {
    fontFamily: typography.sans,
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
  },
  resultCount: {
    fontFamily: typography.sans,
    fontSize: 13,
    fontWeight: '500',
    color: colors.muted,
  },
  toolbarRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
    borderColor: '#BEE4CE',
  },
  activeTagText: {
    fontFamily: typography.sans,
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  desktopDockedSidebar: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  dockedSidebarScroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  edgeReopenHandle: {
    position: 'absolute',
    right: 0,
    top: '42%',
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderTopLeftRadius: radius.md,
    borderBottomLeftRadius: radius.md,
    alignItems: 'center',
    gap: 4,
    zIndex: 30,
  },
  edgeHandleArrow: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 20,
  },
  edgeHandleText: {
    fontFamily: typography.sans,
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  edgeHandleBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 99,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  edgeHandleBadgeText: {
    fontFamily: typography.sans,
    fontSize: 10,
    fontWeight: '800',
    color: colors.amberInk,
  },
  sidebarBody: {
    gap: spacing.md,
  },
  sidebarTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sidebarTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sidebarMainHeading: {
    fontFamily: typography.sans,
    fontSize: 15,
    fontWeight: '700',
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
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  closeSidebarText: {
    fontFamily: typography.sans,
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  sidebarBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sidebarBoxHeader: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  sidebarBoxHeaderText: {
    fontFamily: typography.sans,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  sidebarBoxContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  catTreeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.xs,
  },
  catTreeRowActive: {
    backgroundColor: colors.accentSoft,
  },
  catTreeText: {
    fontFamily: typography.sans,
    fontSize: 13,
    color: colors.ink,
    fontWeight: '500',
  },
  catTreeTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  catTreePlus: {
    fontFamily: typography.sans,
    fontSize: 15,
    fontWeight: '600',
    color: colors.muted,
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  searchInput: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingRight: 32,
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
    fontSize: 11,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.4,
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
  cardWrap: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    justifyContent: 'space-between',
    position: 'relative',
  },
  cardArtContainer: {
    position: 'relative',
  },
  card: {
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  cardArtWrap: {
    position: 'relative',
  },
  cardBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  cardBadgeText: {
    fontFamily: typography.sans,
    fontSize: 11,
    fontWeight: '700',
  },
  freeshipPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(14, 138, 68, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  freeshipText: {
    fontFamily: typography.sans,
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  hoverToolbar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    zIndex: 10,
  },
  hoverCircleBtn: {
    width: 48,
    height: 48,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hoverCircleAccent: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  hoverIconText: {
    fontSize: 21,
    color: colors.ink,
    fontWeight: '700',
  },
  cardBody: {
    gap: 5,
    paddingHorizontal: 2,
  },
  cardTitle: {
    fontFamily: typography.sans,
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    minHeight: 38,
  },
  cardSubMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardSizeSummary: {
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.muted,
  },
  cardStockMini: {
    fontFamily: typography.sans,
    fontSize: 11,
    fontWeight: '600',
    color: colors.accent,
  },
  swatchCircleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 2,
  },
  swatchCircleOuter: {
    width: 22,
    height: 22,
    borderRadius: 99,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchCircleOuterActive: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  swatchCircleInner: {
    width: '100%',
    height: '100%',
    borderRadius: 99,
  },
  moreColorText: {
    fontFamily: typography.sans,
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
  },
  selectedColorName: {
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.muted,
    marginLeft: 2,
  },
  cardPrice: {
    fontFamily: typography.sans,
    fontSize: 16,
    fontWeight: '800',
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
  cardCtaBtn: {
    width: '100%',
  },
  swatchDot: {
    width: 10,
    height: 10,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.borderStrong,
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
    backgroundColor: colors.surfaceSoft,
    padding: spacing.lg,
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
  },
});
