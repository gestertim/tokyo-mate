import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhotoAcquisitionPanel } from './PhotoAcquisitionPanel';

function createFile(name: string, type: string): File {
  return new File(['fake-bytes'], name, { type });
}

describe('PhotoAcquisitionPanel（Phase 2 Photo Acquisition, FR-002 / SC-001）', () => {
  let queryMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    queryMock = vi.fn();
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: { query: queryMock },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'permissions', { configurable: true, value: undefined });
  });

  it('掛載時不觸發任何相機／相簿權限請求', () => {
    render(<PhotoAcquisitionPanel onPhotoAcquired={vi.fn()} />);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('「拍攝照片」對應的檔案輸入具備 capture=environment，「從相簿選擇」則無 capture', () => {
    render(<PhotoAcquisitionPanel onPhotoAcquired={vi.fn()} />);
    const cameraInput = screen.getByTestId('photo-acquisition-camera-input');
    const galleryInput = screen.getByTestId('photo-acquisition-gallery-input');
    expect(cameraInput).toHaveAttribute('capture', 'environment');
    expect(galleryInput).not.toHaveAttribute('capture');
  });

  it('使用者取消拍照時停留在初始狀態，不顯示錯誤', async () => {
    queryMock.mockResolvedValue({ state: 'granted' });
    const user = userEvent.setup();
    render(<PhotoAcquisitionPanel onPhotoAcquired={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '拍攝照片' }));
    const cameraInput = screen.getByTestId('photo-acquisition-camera-input');
    fireEvent.change(cameraInput, { target: { files: [] } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '拍攝照片' })).toBeInTheDocument();
  });

  it('使用者取消選圖時停留在初始狀態，不顯示錯誤', async () => {
    const user = userEvent.setup();
    render(<PhotoAcquisitionPanel onPhotoAcquired={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '從相簿選擇' }));
    const galleryInput = screen.getByTestId('photo-acquisition-gallery-input');
    fireEvent.change(galleryInput, { target: { files: [] } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('相機權限被拒時顯示一般化可恢復訊息，提供改用相簿與再試一次，且不開啟檔案選取', async () => {
    queryMock.mockResolvedValue({ state: 'denied' });
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');
    const user = userEvent.setup();
    render(<PhotoAcquisitionPanel onPhotoAcquired={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '拍攝照片' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('無法使用相機');
    expect(alert).toHaveTextContent('相簿');
    expect(clickSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '再試一次' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '從相簿選擇' })).toBeInTheDocument();
  });

  it('不支援或無法讀取的照片顯示可恢復訊息，且不呈現技術性錯誤', async () => {
    const user = userEvent.setup();
    render(<PhotoAcquisitionPanel onPhotoAcquired={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '從相簿選擇' }));
    const galleryInput = screen.getByTestId('photo-acquisition-gallery-input');
    const badFile = createFile('note.pdf', 'application/pdf');
    fireEvent.change(galleryInput, { target: { files: [badFile] } });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('這張照片無法使用');
    expect(alert).not.toHaveTextContent('pdf');
    expect(alert).not.toHaveTextContent('application/');
    expect(screen.getByRole('button', { name: '拍攝照片' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '從相簿選擇' })).toBeInTheDocument();
  });

  it('成功取得有效照片時呼叫 onPhotoAcquired 並附上 objectUrl／檔名／MIME', async () => {
    queryMock.mockResolvedValue({ state: 'granted' });
    const createObjectURLMock = vi.fn(() => 'blob:mock-url');
    vi.stubGlobal('URL', { ...URL, createObjectURL: createObjectURLMock, revokeObjectURL: vi.fn() });
    const onPhotoAcquired = vi.fn();
    const user = userEvent.setup();
    render(<PhotoAcquisitionPanel onPhotoAcquired={onPhotoAcquired} />);
    await user.click(screen.getByRole('button', { name: '從相簿選擇' }));
    const galleryInput = screen.getByTestId('photo-acquisition-gallery-input');
    const goodFile = createFile('menu.jpg', 'image/jpeg');
    fireEvent.change(galleryInput, { target: { files: [goodFile] } });
    await waitFor(() => expect(onPhotoAcquired).toHaveBeenCalledWith({
      objectUrl: 'blob:mock-url',
      fileName: 'menu.jpg',
      mimeType: 'image/jpeg',
    }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
