/* App entry — renders everything */

function App() {
  return (
    <React.Fragment>
      <Navbar/>
      <Hero/>
      <InsightSection/>
      <Pillars/>
      <VaNiSection/>
      <Personas/>
      <OriginAndCTA/>
      <Footer/>
    </React.Fragment>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App/>);

/* Smooth scroll for anchor clicks (manual, no scrollIntoView) */
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href').slice(1);
  if (!id) return;
  const el = document.getElementById(id);
  if (!el) return;
  e.preventDefault();
  const top = el.getBoundingClientRect().top + window.scrollY - 60;
  window.scrollTo({ top, behavior: 'smooth' });
});
