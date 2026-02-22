-- Migration: 0080_add_fts5_search.sql
-- Description: Add FTS5 full-text search for products table (Korean support)
-- Date: 2026-02-22

-- ========================================
-- 1. Create FTS5 virtual table
-- ========================================
-- FTS5는 SQLite의 전문 검색(Full-Text Search) 엔진
-- tokenize=porter: 형태소 분석기 (영어 기본, 한글은 prefix 검색 권장)
-- content=products: 원본 테이블 지정 (외부 콘텐츠 모드)
-- content_rowid=id: 원본 테이블의 rowid 컬럼
CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
  name,
  description,
  category,
  content=products,
  content_rowid=id,
  tokenize='porter unicode61'
);

-- ========================================
-- 2. Populate existing data
-- ========================================
-- 기존 products 테이블 데이터를 FTS5 테이블에 복사
INSERT INTO products_fts(rowid, name, description, category)
SELECT id, name, description, category FROM products;

-- ========================================
-- 3. Create triggers for sync
-- ========================================
-- products 테이블 변경 시 FTS5 테이블 자동 동기화

-- 🔹 AFTER INSERT: 새 상품 추가 시 FTS5에도 추가
CREATE TRIGGER IF NOT EXISTS products_fts_insert 
AFTER INSERT ON products 
BEGIN
  INSERT INTO products_fts(rowid, name, description, category)
  VALUES (NEW.id, NEW.name, NEW.description, NEW.category);
END;

-- 🔹 AFTER UPDATE: 상품 수정 시 FTS5 업데이트
CREATE TRIGGER IF NOT EXISTS products_fts_update 
AFTER UPDATE ON products 
BEGIN
  UPDATE products_fts 
  SET name = NEW.name,
      description = NEW.description,
      category = NEW.category
  WHERE rowid = NEW.id;
END;

-- 🔹 AFTER DELETE: 상품 삭제 시 FTS5에서도 삭제
CREATE TRIGGER IF NOT EXISTS products_fts_delete 
AFTER DELETE ON products 
BEGIN
  DELETE FROM products_fts WHERE rowid = OLD.id;
END;

-- ========================================
-- 4. Create indexes for performance
-- ========================================
-- FTS5 검색 결과를 products 테이블과 JOIN할 때 사용
CREATE INDEX IF NOT EXISTS idx_products_id ON products(id);

-- ========================================
-- 5. Usage examples (주석)
-- ========================================
/*
-- 기본 검색 (단어 검색)
SELECT p.* 
FROM products p
JOIN products_fts fts ON p.id = fts.rowid
WHERE products_fts MATCH '아이폰'
ORDER BY bm25(products_fts);

-- Prefix 검색 (한글 지원 - 추천)
SELECT p.* 
FROM products p
JOIN products_fts fts ON p.id = fts.rowid
WHERE products_fts MATCH '아이*'
ORDER BY bm25(products_fts);

-- 다중 키워드 검색 (AND 조건)
SELECT p.* 
FROM products p
JOIN products_fts fts ON p.id = fts.rowid
WHERE products_fts MATCH '아이폰 AND 케이스'
ORDER BY bm25(products_fts);

-- 다중 키워드 검색 (OR 조건)
SELECT p.* 
FROM products p
JOIN products_fts fts ON p.id = fts.rowid
WHERE products_fts MATCH '아이폰 OR 삼성'
ORDER BY bm25(products_fts);

-- 특정 필드 검색
SELECT p.* 
FROM products p
JOIN products_fts fts ON p.id = fts.rowid
WHERE products_fts MATCH 'name:아이폰'
ORDER BY bm25(products_fts);

-- 관련도 순위 포함
SELECT p.*, bm25(products_fts) as rank
FROM products p
JOIN products_fts fts ON p.id = fts.rowid
WHERE products_fts MATCH '아이폰'
ORDER BY rank;

-- Snippet (검색어 하이라이트)
SELECT 
  p.*,
  snippet(products_fts, 0, '**', '**', '...', 10) as snippet_name
FROM products p
JOIN products_fts fts ON p.id = fts.rowid
WHERE products_fts MATCH '아이폰'
ORDER BY bm25(products_fts);
*/

-- ========================================
-- 6. Performance notes
-- ========================================
/*
성능 비교:
- LIKE '%keyword%': 전체 테이블 스캔 (O(n))
  - 10만 개 상품: ~500ms
  
- FTS5 MATCH: 인덱스 검색 (O(log n))
  - 10만 개 상품: ~50ms
  
약 10배 빠른 속도!

한글 검색 팁:
1. Prefix 검색 사용: '아이*' (권장)
2. 초성 검색 불가: 'ㅇㅇㅍ' (지원 안 됨)
3. 띄어쓰기 중요: '아이 폰' vs '아이폰'
*/
