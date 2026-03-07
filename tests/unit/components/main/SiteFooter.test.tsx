import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import SiteFooter from '@/components/main/SiteFooter';

describe('SiteFooter', () => {
  it('renders contact email', () => {
    render(
      <BrowserRouter>
        <SiteFooter />
      </BrowserRouter>
    );

    expect(screen.getByText(/제휴 \| 입점 문의/)).toBeInTheDocument();
  });

  it('renders service terms link', () => {
    render(
      <BrowserRouter>
        <SiteFooter />
      </BrowserRouter>
    );

    const termsLink = screen.getByText('서비스 이용약관');
    expect(termsLink).toBeInTheDocument();
    expect(termsLink).toHaveAttribute('href', '/terms');
  });

  it('renders privacy policy link', () => {
    render(
      <BrowserRouter>
        <SiteFooter />
      </BrowserRouter>
    );

    const privacyLink = screen.getByText('개인정보처리방침');
    expect(privacyLink).toBeInTheDocument();
    expect(privacyLink).toHaveAttribute('href', '/privacy');
  });

  it('renders refund policy link', () => {
    render(
      <BrowserRouter>
        <SiteFooter />
      </BrowserRouter>
    );

    const refundLink = screen.getByText('배송 및 환불 정책');
    expect(refundLink).toBeInTheDocument();
    expect(refundLink).toHaveAttribute('href', '/refund');
  });

  it('renders company name', () => {
    render(
      <BrowserRouter>
        <SiteFooter />
      </BrowserRouter>
    );

    expect(screen.getByText(/상호명: 리스터코퍼레이션/)).toBeInTheDocument();
  });

  it('renders CEO name', () => {
    render(
      <BrowserRouter>
        <SiteFooter />
      </BrowserRouter>
    );

    expect(screen.getByText(/대표자: 정지원/)).toBeInTheDocument();
  });

  it('renders business registration number', () => {
    render(
      <BrowserRouter>
        <SiteFooter />
      </BrowserRouter>
    );

    expect(screen.getByText(/사업자등록번호: 479-09-02930/)).toBeInTheDocument();
  });

  it('renders e-commerce registration number', () => {
    render(
      <BrowserRouter>
        <SiteFooter />
      </BrowserRouter>
    );

    expect(screen.getByText(/통신판매업신고: 2025-부산금정-0540/)).toBeInTheDocument();
  });

  it('renders business address', () => {
    render(
      <BrowserRouter>
        <SiteFooter />
      </BrowserRouter>
    );

    expect(screen.getByText(/부산광역시 금정구 놀이마당로26 1402/)).toBeInTheDocument();
  });

  it('renders phone number', () => {
    render(
      <BrowserRouter>
        <SiteFooter />
      </BrowserRouter>
    );

    expect(screen.getByText(/대표전화: 0507-0177-0432/)).toBeInTheDocument();
  });

  it('renders representative email', () => {
    render(
      <BrowserRouter>
        <SiteFooter />
      </BrowserRouter>
    );

    expect(screen.getByText(/대표이메일: jiwon@ur-team.com/)).toBeInTheDocument();
  });

  it('renders service delivery period', () => {
    render(
      <BrowserRouter>
        <SiteFooter />
      </BrowserRouter>
    );

    expect(screen.getByText(/서비스 제공 기간: 상품 구매 후 평균 7일 이내 배송 완료/)).toBeInTheDocument();
  });

  it('renders copyright notice', () => {
    render(
      <BrowserRouter>
        <SiteFooter />
      </BrowserRouter>
    );

    expect(screen.getByText(/© 2026 리스터코퍼레이션. All rights reserved./)).toBeInTheDocument();
  });

  it('renders partnership inquiry text', () => {
    render(
      <BrowserRouter>
        <SiteFooter />
      </BrowserRouter>
    );

    expect(screen.getByText(/제휴 \| 입점 문의/)).toBeInTheDocument();
  });

  it('has proper footer styling', () => {
    const { container } = render(
      <BrowserRouter>
        <SiteFooter />
      </BrowserRouter>
    );

    const footer = container.querySelector('footer');
    expect(footer).toHaveClass('px-4', 'py-6', 'bg-background', 'border-t');
  });

  it('policy links have underline and hover effect', () => {
    render(
      <BrowserRouter>
        <SiteFooter />
      </BrowserRouter>
    );

    const termsLink = screen.getByText('서비스 이용약관');
    expect(termsLink).toHaveClass('underline', 'hover:text-gray-900');

    const privacyLink = screen.getByText('개인정보처리방침');
    expect(privacyLink).toHaveClass('underline', 'hover:text-gray-900');

    const refundLink = screen.getByText('배송 및 환불 정책');
    expect(refundLink).toHaveClass('underline', 'hover:text-gray-900');
  });

  it('renders pipe separators between links', () => {
    const { container } = render(
      <BrowserRouter>
        <SiteFooter />
      </BrowserRouter>
    );

    const separators = Array.from(container.querySelectorAll('span')).filter(
      span => span.textContent === '|'
    );
    expect(separators.length).toBeGreaterThanOrEqual(2);
  });

  it('contact info has proper text color', () => {
    const { container } = render(
      <BrowserRouter>
        <SiteFooter />
      </BrowserRouter>
    );

    const textElements = container.querySelectorAll('.text-gray-600');
    expect(textElements.length).toBeGreaterThan(0);
  });

  it('renders complete company information section', () => {
    render(
      <BrowserRouter>
        <SiteFooter />
      </BrowserRouter>
    );

    // All essential company info should be present
    expect(screen.getByText(/사업자등록번호/)).toBeInTheDocument();
    expect(screen.getByText(/사업장주소/)).toBeInTheDocument();
    expect(screen.getByText(/대표전화/)).toBeInTheDocument();
  });
});
