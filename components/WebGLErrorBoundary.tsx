'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string | null;
}

export class WebGLErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('WebGL / 3D Canvas Error Caught:', error, errorInfo);
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="webgl-error-fallback">
          <div className="webgl-error-card">
            <h2>⚠️ Trình duyệt gặp sự cố đồ họa WebGL</h2>
            <p>
              Ngữ cảnh đồ họa 3D đã bị gián đoạn (do thiếu VRAM hoặc card đồ họa bị reset).
            </p>
            {this.state.errorMessage && (
              <pre className="webgl-error-details">{this.state.errorMessage}</pre>
            )}
            <button
              type="button"
              className="modal-confirm-btn"
              onClick={this.handleReload}
            >
              🔄 Tải lại trang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

