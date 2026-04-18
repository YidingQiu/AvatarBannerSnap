import { Editor } from '@avatarbannersnap/editor';
import { LINKEDIN } from '@avatarbannersnap/editor';
import CalibrationPage from './dev/CalibrationPage';

export default function App() {
  if (import.meta.env.DEV && window.location.pathname === '/dev/calibration') {
    return <CalibrationPage />;
  }

  return (
    <>
      <Editor platform={LINKEDIN} />
      {import.meta.env.DEV && (
        <p style={{ textAlign: 'center', fontSize: 12, color: '#aaa', marginTop: 24 }}>
          Dev: <a href="/dev/calibration">Calibration Tool</a>
        </p>
      )}
    </>
  );
}
