// Firebase 테스트 스크립트
// 테스트용 데이터를 Firebase에 직접 작성

const testData = {
  // 테스트 스트림 데이터
  stream1: {
    id: 1,
    title: "테스트 라이브 방송",
    status: "live",
    current_product_id: 101,
    viewer_count: 25,
    updated_at: Date.now()
  },
  
  // 테스트 상품 데이터
  product101: {
    id: 101,
    name: "테스트 상품",
    price: 29900,
    original_price: 39900,
    discount_rate: 25,
    stock: 50,
    image_url: "https://via.placeholder.com/300",
    updated_at: Date.now()
  }
};

console.log('Test data prepared:', testData);
