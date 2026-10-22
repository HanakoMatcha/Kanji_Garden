import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

const CategoryFilters: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
  // Solo se muestra en las carpetas /vocab o /kanji
  if (!fileData.slug?.startsWith("vocab") && !fileData.slug?.startsWith("kanji")) {
    return null
  }

  return (
    <div class="category-filter-wrapper">
      <div class="filter-buttons">
        <button class="filter-btn active" data-tag="all">Todos</button>
        <button class="filter-btn" data-tag="jlpt-n1">N1</button>
        <button class="filter-btn" data-tag="jlpt-n2">N2</button>
        <button class="filter-btn" data-tag="jlpt-n3">N3</button>
        <button class="filter-btn" data-tag="jlpt-n4">N4</button>
        <button class="filter-btn" data-tag="jlpt-n5">N5</button>
      </div>
    </div>
  )
}

CategoryFilters.css = `
.category-filter-wrapper {
  margin: 1.5rem 0;
}
.filter-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.filter-btn {
  background: var(--lightgray);
  color: var(--dark);
  border: 1px solid var(--gray);
  padding: 0.35rem 0.8rem;
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}
.filter-btn:hover, .filter-btn.active {
  background: var(--secondary);
  color: var(--light);
  border-color: var(--secondary);
}
.page-listing li.filter-hidden {
  display: none !important;
}
`

CategoryFilters.afterDOMLoaded = `
document.addEventListener("nav", () => {
  const buttons = document.querySelectorAll(".filter-btn")
  const items = document.querySelectorAll(".page-listing li")

  buttons.forEach((btn) => {
    btn.onclick = () => {
      buttons.forEach((b) => b.classList.remove("active"))
      btn.classList.add("active")

      const tag = btn.getAttribute("data-tag")

      items.forEach((item) => {
        if (tag === "all") {
          item.classList.remove("filter-hidden")
        } else {
          const links = Array.from(item.querySelectorAll("a.internal.tag-link, a[href*='tags/']"))
          const match = links.some((a) => a.textContent?.includes(tag) || a.getAttribute("href")?.includes(tag))
          if (match) {
            item.classList.remove("filter-hidden")
          } else {
            item.classList.add("filter-hidden")
          }
        }
      })
    }
  })
})
`

export default (() => CategoryFilters) satisfies QuartzComponentConstructor
