import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import NotFoundPage from '../../pages/NotFoundPage';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

function renderNotFoundPage() {
  return render(
    <ConfigProvider>
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    </ConfigProvider>,
  );
}

describe('NotFoundPage', () => {
  it('渲染 404 提示文字', () => {
    renderNotFoundPage();
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('抱歉，您訪問的頁面不存在')).toBeInTheDocument();
  });

  it('「返回首頁」按鈕存在', () => {
    renderNotFoundPage();
    expect(screen.getByRole('button', { name: /返回首頁/i })).toBeInTheDocument();
  });
});
