import { getProducts } from "./firebase.js"

// Product Form Submit
/*var productForm = document.getElementById('productForm');
productForm.addEventListener('submit', function (event) {
  event.preventDefault();
  var productNameInput = document.getElementById('productName');
  var productDescriptionInput = document.getElementById('productDescription');
  var productTagsSelect = document.getElementById('productTags');
  var selectedTags = Array.from(productTagsSelect.selectedOptions).map(function (option) {
    return option.value;
  });
  var product = Product.new(
    productNameInput.value,
    undefined,
    productDescriptionInput.value,
    selectedTags,
    undefined,
  );
  addProduct(product)
  products.push(product);
  productNameInput.value = '';
  productDescriptionInput.value = '';
  productTagsSelect.selectedIndex = -1;
  renderProductList();
  refreshOrderProductNames();
});

// Render Product List
function renderProductList() {
  var productList = document.getElementById('productList');
  var productListBody = productList.querySelector('tbody');
  productListBody.innerHTML = '';
  products.forEach(function (product) {
    var row = document.createElement('tr');
    var nameCell = document.createElement('td');
    nameCell.textContent = product.name;
    var descriptionCell = document.createElement('td');
    descriptionCell.textContent = product.description;
    var tagsCell = document.createElement('td');
    tagsCell.textContent = product.tags.join(', ');
    var actionsCell = document.createElement('td');
    var deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.className = 'btn btn-danger btn-sm';
    deleteButton.addEventListener('click', function () {
      var index = products.indexOf(product);
      if (index !== -1) {
        products.splice(index, 1);
        renderProductList();
        refreshOrderProductNames();
      }
    });
    actionsCell.appendChild(deleteButton);
    row.appendChild(nameCell);
    row.appendChild(descriptionCell);
    row.appendChild(tagsCell);
    row.appendChild(actionsCell);
    productListBody.appendChild(row);
  });
}


function refreshProductTags() {
  var productTagsSelect = document.getElementById('productTags');
  var selectedTags = Array.from(productTagsSelect.selectedOptions).map(function (option) {
    return option.value;
  });
  renderProductTags(productTagsSelect, selectedTags);
}

// Refresh Product Names buttons in Add Order to Todo List tab
var refreshOrderProductNameButton = document.getElementById('refreshOrderProductNameButton');
refreshOrderProductNameButton.addEventListener('click', refreshOrderProductNames);

function refreshOrderProductNames() {
  var orderProductNameSelect = document.getElementById('orderProductName');
  var selectedProductName = orderProductNameSelect.value;
  renderOrderProductNames(orderProductNameSelect, selectedProductName);
}

// Activate the corresponding tab when a link is clicked
document.getElementById('productTabLink').addEventListener('click', function (event) {
  event.preventDefault();
  adminTabs.show('productTab');
});

document.getElementById('tagTabLink').addEventListener('click', function (event) {
  event.preventDefault();
  adminTabs.show('tagTab');
});

document.getElementById('orderTabLink').addEventListener('click', function (event) {
  event.preventDefault();
  adminTabs.show('orderTab');
});*/