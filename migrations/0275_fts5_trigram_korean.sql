-- 🛡️ 2026-05-20: 한국어 검색 정확도 개선 — trigram tokenizer 로 전환.
--
-- 배경: 0080 의 porter unicode61 tokenizer 는 영어 형태소 기반 → 한국어 부분 매칭 약함.
--   "스타벅스" 검색 시 "스타벅스 아메리카노" 는 매치되지만 "스벅" 은 unmatched.
--   trigram (3-char n-gram) 으로 전환하면 substring 매칭 + Levenshtein 보정과 시너지.
--
-- 절차:
--   1. 기존 products_fts (porter unicode61) 와 trigger 모두 DROP
--   2. trigram tokenizer 로 products_fts 재생성
--   3. 데이터 재로딩
--   4. trigger 재생성

DROP TRIGGER IF EXISTS products_fts_insert;
DROP TRIGGER IF EXISTS products_fts_update;
DROP TRIGGER IF EXISTS products_fts_delete;
DROP TABLE IF EXISTS products_fts;

-- trigram tokenizer — SQLite 3.34+ 지원 (D1 은 3.42+ 사용).
-- case_sensitive=0: 대소문자 무시.
-- remove_diacritics=1: ㄱ/ㄴ 자음 normalize (한국어 효과 제한적이지만 영어 액센트 처리).
CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
  name,
  description,
  category,
  content=products,
  content_rowid=id,
  tokenize="trigram case_sensitive 0 remove_diacritics 1"
);

INSERT INTO products_fts(rowid, name, description, category)
SELECT id, COALESCE(name,''), COALESCE(description,''), COALESCE(category,'') FROM products;

CREATE TRIGGER IF NOT EXISTS products_fts_insert
AFTER INSERT ON products
BEGIN
  INSERT INTO products_fts(rowid, name, description, category)
  VALUES (NEW.id, COALESCE(NEW.name,''), COALESCE(NEW.description,''), COALESCE(NEW.category,''));
END;

CREATE TRIGGER IF NOT EXISTS products_fts_update
AFTER UPDATE ON products
BEGIN
  UPDATE products_fts
  SET name = COALESCE(NEW.name,''),
      description = COALESCE(NEW.description,''),
      category = COALESCE(NEW.category,'')
  WHERE rowid = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS products_fts_delete
AFTER DELETE ON products
BEGIN
  DELETE FROM products_fts WHERE rowid = OLD.id;
END;
