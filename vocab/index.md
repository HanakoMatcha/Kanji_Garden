---
title: Vocabulario
---

<div class="filter-container">
  <button class="filter-btn active" data-filter="all">Todos</button>
  <button class="filter-btn" data-filter="jlpt-n1">JLPT N1</button>
  <button class="filter-btn" data-filter="jlpt-n2">JLPT N2</button>
  <button class="filter-btn" data-filter="jlpt-n3">JLPT N3</button>
  <button class="filter-btn" data-filter="jlpt-n4">JLPT N4</button>
  <button class="filter-btn" data-filter="jlpt-n5">JLPT N5</button>
</div>

<style>
.filter-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 1.5rem 0;
}
.filter-btn {
  background: var(--lightgray);
  color: var(--dark);
  border: 1px solid var(--gray);
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
}
.filter-btn:hover, .filter-btn.active {
  background: var(--secondary);
  color: var(--light);
  border-color: var(--secondary);
}
.page-listing .section-li.hidden {
  display: none !important;
}
</style>

<script>
document.addEventListener("nav", () => {
  const buttons = document.querySelectorAll(".filter-btn");
  const items = document.querySelectorAll(".page-listing .section-li");

  buttons.forEach((btn) => {
    btn.onclick = () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const filter = btn.getAttribute("data-filter");

      items.forEach((item) => {
        if (filter === "all") {
          item.classList.remove("hidden");
        } else {
          // Busca si el item contiene el enlace al tag correspondiente
          const hasTag = item.querySelector(`a[href*="tags/${filter}"]`);
          if (hasTag) {
            item.classList.remove("hidden");
          } else {
            item.classList.add("hidden");
          }
        }
      });
    };
  });
});
</script>
