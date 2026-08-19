import { Component } from 'react';

/**
 * Menangkap error render agar layar tidak pernah kosong tanpa penjelasan.
 * Tanpa ini, satu kesalahan kecil di satu komponen membuat seluruh halaman putih.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Aplikasi berhenti:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page">
        <h1 className="mark">Ada yang tidak beres</h1>
        <p className="lede">
          Halaman ini gagal ditampilkan. Coba muat ulang; kalau tetap gagal, salin pesan di bawah.
        </p>
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'var(--mono)',
            fontSize: 12,
            background: 'var(--paper)',
            border: '1px solid var(--rule)',
            borderRadius: 11,
            padding: '12px 14px',
            color: 'var(--danger)',
          }}
        >
          {String(this.state.error?.stack || this.state.error)}
        </pre>
        <button className="btn" onClick={() => window.location.reload()}>
          Muat ulang
        </button>
      </div>
    );
  }
}