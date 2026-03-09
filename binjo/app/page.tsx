import { prisma } from "@/lib/db";
import HeroSection from "@/components/brand/HeroSection";
import StorySection from "@/components/brand/StorySection";
import ProductsSection from "@/components/brand/ProductsSection";
import CalendarSection from "@/components/brand/CalendarSection";
import GallerySection from "@/components/brand/GallerySection";
import ReviewsSection from "@/components/brand/ReviewsSection";
import OrderSection from "@/components/brand/OrderSection";
import StickyOrderCTA from "@/components/brand/StickyOrderCTA";
import YoutubeSection from "@/components/brand/YoutubeSection";
import { FarmProfile, ProductItem, CalendarMonth, GalleryPhotoItem, ReviewItem } from "@/types";

export const revalidate = 60; // ISR: revalidate every 60s

async function getData() {
  const [farm, products, calendar, gallery, reviews] = await Promise.all([
    prisma.farm.findFirst(),
    prisma.product.findMany({ orderBy: { sort_order: "asc" } }),
    prisma.seasonalCalendar.findMany({ orderBy: { month: "asc" } }),
    prisma.galleryPhoto.findMany({ orderBy: { sort_order: "asc" } }),
    prisma.review.findMany({
      where: { is_visible: true },
      orderBy: { sort_order: "asc" },
    }),
  ]);
  return { farm, products, calendar, gallery, reviews };
}

export default async function BrandPage() {
  const { farm, products, calendar, gallery, reviews } = await getData();

  if (!farm) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#FDFBF7" }}>
        <p style={{ color: "#9B9B9B" }}>농장 정보를 불러오는 중...</p>
      </div>
    );
  }

  const farmProfile: FarmProfile = {
    ...farm,
    latitude: farm.latitude ? Number(farm.latitude) : null,
    longitude: farm.longitude ? Number(farm.longitude) : null,
    stats: farm.stats as FarmProfile["stats"],
  };

  const productItems: ProductItem[] = products.map((p) => ({
    ...p,
    price_options: p.price_options as ProductItem["price_options"],
  }));

  const calendarMonths: CalendarMonth[] = calendar.map((c) => ({
    id: c.id,
    month: c.month,
    activities: c.activities,
    available_products: c.available_products,
    highlight: c.highlight,
  }));

  const galleryItems: GalleryPhotoItem[] = gallery.map((g) => ({
    id: g.id,
    image_url: g.image_url,
    caption: g.caption,
    taken_at: g.taken_at ? g.taken_at.toISOString() : null,
    sort_order: g.sort_order,
  }));

  const reviewItems: ReviewItem[] = reviews.map((r) => ({
    id: r.id,
    customer_name: r.customer_name,
    customer_location: r.customer_location,
    content: r.content,
    rating: r.rating,
    sort_order: r.sort_order,
  }));

  return (
    <main>
      <HeroSection farm={farmProfile} />
      <StorySection farm={farmProfile} />
      <ProductsSection products={productItems} />
      <CalendarSection calendar={calendarMonths} />
      {farm.youtube_url && <YoutubeSection youtubeUrl={farm.youtube_url} />}
      <GallerySection photos={galleryItems} />
      <ReviewsSection reviews={reviewItems} />
      <OrderSection farm={farmProfile} products={productItems} />
      <StickyOrderCTA
        kakaoUrl={farm.kakao_chat_url}
        phone={farm.phone}
      />
    </main>
  );
}
