export function ReturnPolicySection() {
  return (
    <div className="bg-muted/30">
      <h2 className="text-sm font-bold text-foreground mb-4">교환 및 반품 안내</h2>
      
      {/* 신청 방법 */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-foreground mb-2">신청 방법</h3>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          상품을 수령하신 날로부터 7일 이내 메신저 및 홈페이지 Q&A게시판 접수
        </p>
      </div>

      {/* 배송 비용 */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-foreground mb-2">배송 비용</h3>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          단순 변심은 왕복 택배비 6,000원
        </p>
      </div>

      {/* 반품 주소 */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-foreground mb-2">반품 주소</h3>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          서울시 강남구 테헤란로 123 커머스 센터 (교환/반품 전용)
        </p>
      </div>

      {/* 유의 사항 */}
      <div>
        <h3 className="text-xs font-semibold text-foreground mb-2">유의 사항</h3>
        <ul className="space-y-1.5">
          <li className="text-[11px] text-muted-foreground leading-relaxed pl-3 relative before:content-['•'] before:absolute before:left-0">
            상품 하자 외 단순 변심으로 인한 교환/반품의 경우 왕복 배송비(6,000원)는 고객 부담입니다
          </li>
          <li className="text-[11px] text-muted-foreground leading-relaxed pl-3 relative before:content-['•'] before:absolute before:left-0">
            상품 수령일로부터 7일 이내 교환/반품 접수 가능하며, 배송 시작 후에는 취소가 불가합니다
          </li>
          <li className="text-[11px] text-muted-foreground leading-relaxed pl-3 relative before:content-['•'] before:absolute before:left-0">
            상품 및 상품 포장의 훼손, 사용 흔적이 있는 경우 교환/반품이 불가능합니다
          </li>
          <li className="text-[11px] text-muted-foreground leading-relaxed pl-3 relative before:content-['•'] before:absolute before:left-0">
            상품 불량 또는 오배송의 경우 무상 교환/반품이 가능합니다
          </li>
          <li className="text-[11px] text-muted-foreground leading-relaxed pl-3 relative before:content-['•'] before:absolute before:left-0">
            배송 완료 후 7일이 경과한 경우 교환/반품이 불가능합니다
          </li>
        </ul>
      </div>

      {/* 제22조 (환불) */}
      <div className="mt-6 pt-6 border-t border-border">
        <h3 className="text-xs font-semibold text-foreground mb-2">제22조 (환불)</h3>
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            ① 회사는 이용자가 구매신청한 상품 등이 품절 등의 사유로 인도 또는 제공을 할 수 없을 때에는 
            지체 없이 그 사유를 이용자에게 통지하고 사전에 재화 등의 대금을 받은 경우에는 
            대금을 받은 날부터 3영업일 이내에 환급하거나 환급에 필요한 조치를 취합니다.
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            ② 전자상거래 등에서의 소비자보호에 관한 법률 제15조의 규정에 의한 소비자의 청약철회가 
            있을 경우 이미 수령한 재화 등이 반환된 경우에는 재화 등을 반환받은 날로부터 
            3영업일 이내에 이미 지급받은 재화 등의 대금을 환급합니다.
          </p>
        </div>
      </div>
    </div>
  )
}
