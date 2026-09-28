
import Header from './Header';

type LayoutProps = {
  children: React.ReactNode;
};

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="flex flex-col min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[1200] focus:bg-white focus:text-blue-700 focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        본문으로 건너뛰기
      </a>
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-grow container mx-auto p-4">{children}</main>
    </div>
  );
};

export default Layout;
