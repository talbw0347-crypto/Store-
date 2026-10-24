import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingCart, Package, BarChart3, Settings, Shield, User, Lock, 
  LogOut, Plus, Trash2, Edit2, Search, Printer, CheckCircle, 
  AlertTriangle, DollarSign, RefreshCw, X, Download, Upload, FileText,
  Key, Layers, Tag, ChevronRight, Check, Eye, Bell, TrendingUp, Camera, Scan, HelpCircle,
  Smartphone, Globe
} from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/library';

// Types
interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  barcode: string;
}

interface CartItem extends Product {
  quantity: number;
}

interface Sale {
  id: string;
  date: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  change: number;
  cashier: string;
}

const DEFAULT_PRODUCTS: Product[] = [];

export default function App() {
  // Navigation & Role State
  const [activeRole, setActiveRole] = useState<'cashier' | 'manager'>('manager');
  const [currentTab, setCurrentTab] = useState<'pos' | 'inventory' | 'sales' | 'settings'>('inventory');
  
  // Storage States
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('smart_pos_products');
      return saved ? JSON.parse(saved) : DEFAULT_PRODUCTS;
    } catch {
      return DEFAULT_PRODUCTS;
    }
  });

  const [sales, setSales] = useState<Sale[]>(() => {
    try {
      const saved = localStorage.getItem('smart_pos_sales');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [managerPin, setManagerPin] = useState<string>(() => {
    return localStorage.getItem('smart_pos_pin') || '12345';
  });

  // POS State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [discountAmount, setDiscountAmount] = useState<number | ''>('');
  const [amountPaid, setAmountPaid] = useState<number | ''>('');
  
  // Modals & Notifications
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // Product Add/Edit Modal
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    category: 'عام',
    price: '',
    cost: '',
    stock: '',
    barcode: ''
  });

  // Camera Scanner Modal State
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<'pos' | 'product_form'>('pos');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(false);

  // Inventory Search & Filters
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState('الكل');

  // Settings State
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [notificationBanner, setNotificationBanner] = useState<string | null>(null);

  // Sync to localStorage safely
  useEffect(() => {
    try {
      localStorage.setItem('smart_pos_products', JSON.stringify(products));
    } catch (err) {
      console.error('Failed to save products', err);
    }
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem('smart_pos_sales', JSON.stringify(sales));
    } catch (err) {
      console.error('Failed to save sales', err);
    }
  }, [sales]);

  useEffect(() => {
    try {
      localStorage.setItem('smart_pos_pin', managerPin);
    } catch (err) {
      console.error('Failed to save PIN', err);
    }
  }, [managerPin]);

  const showNotification = (msg: string) => {
    setNotificationBanner(msg);
    setTimeout(() => setNotificationBanner(null), 3500);
  };

  // Camera Scanner Effect
  useEffect(() => {
    if (showScannerModal && cameraPermissionGranted) {
      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;
      setScannerError(null);

      codeReader.decodeFromVideoDevice(null, videoRef.current!, (result, err) => {
        if (result) {
          const scannedText = result.getText();
          handleSuccessfulScan(scannedText);
        }
        if (err && !(err.name === 'NotFoundException' || err.name === 'ChecksumException' || err.name === 'FormatException')) {
          // Ignore routine search misses
        }
      }).catch((err) => {
        console.error('Camera access error:', err);
        setScannerError('تعذر فتح الكاميرا. يرجى التأكد من منح صلاحية الكاميرا للمتصفح.');
      });
    } else {
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
        codeReaderRef.current = null;
      }
    }

    return () => {
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
        codeReaderRef.current = null;
      }
    };
  }, [showScannerModal, cameraPermissionGranted]);

  const requestCameraAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.getTracks().forEach(track => track.stop());
      setCameraPermissionGranted(true);
      setScannerError(null);
    } catch (err) {
      console.error('Permission denied:', err);
      setScannerError('تم رفض إذن الكاميرا. يرجى الضغط على زر السماح في شريط المتصفح.');
    }
  };

  const handleSuccessfulScan = (code: string) => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
    }
    setShowScannerModal(false);
    setCameraPermissionGranted(false);

    if (scannerTarget === 'pos') {
      const found = products.find(p => p.barcode === code);
      if (found) {
        addToCart(found);
        showNotification(`تمت إضافة: ${found.name}`);
      } else {
        showNotification(`لم يُعثر على منتج بالباركود: ${code}. أضفه من قسم المخزون.`);
      }
    } else if (scannerTarget === 'product_form') {
      setProductForm(prev => ({ ...prev, barcode: code }));
      showNotification(`تم التقاط الباركود: ${code}`);
    }
  };

  // Categories list
  const categories = ['الكل', ...Array.from(new Set(products.map(p => p.category)))];

  // Filtered products for POS
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode.includes(searchQuery);
    const matchesCat = selectedCategory === 'الكل' || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  // Filtered products for Inventory
  const filteredInventoryProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(inventorySearch.toLowerCase()) || p.barcode.includes(inventorySearch);
    const matchesCat = inventoryCategoryFilter === 'الكل' || p.category === inventoryCategoryFilter;
    return matchesSearch && matchesCat;
  });

  // Cart Management
  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      showNotification('عذراً، هذا المنتج نفد من المخزون!');
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          showNotification('لا يمكن إضافة كمية أكبر من المتوفر في المخزون.');
          return prev;
        }
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === id) {
          const product = products.find(p => p.id === id);
          const newQty = item.quantity + delta;
          if (product && newQty > product.stock) {
            showNotification('الكمية المطلوبة تتجاوز المخزون المتوفر.');
            return item;
          }
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountAmount('');
    setAmountPaid('');
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    const found = products.find(p => p.barcode === barcodeInput.trim());
    if (found) {
      addToCart(found);
      setBarcodeInput('');
    } else {
      showNotification('لم يتم العثور على منتج بهذا الباركود.');
      setBarcodeInput('');
    }
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountNum = typeof discountAmount === 'number' ? discountAmount : 0;
  const finalTotal = Math.max(0, subtotal - discountNum);
  const paidNum = typeof amountPaid === 'number' ? amountPaid : finalTotal;
  const changeDue = Math.max(0, paidNum - finalTotal);

  // Checkout
  const handleCheckout = () => {
    if (cart.length === 0) return;
    if (paidNum < finalTotal) {
      showNotification('المبلغ المدفوع أقل من إجمالي الفاتورة!');
      return;
    }

    const updatedProducts = products.map(prod => {
      const cartItem = cart.find(c => c.id === prod.id);
      if (cartItem) {
        return { ...prod, stock: Math.max(0, prod.stock - cartItem.quantity) };
      }
      return prod;
    });
    setProducts(updatedProducts);

    const newSale: Sale = {
      id: 'INV-' + Math.floor(100000 + Math.random() * 900000),
      date: new Date().toLocaleString('ar-SA'),
      items: [...cart],
      subtotal,
      discount: discountNum,
      total: finalTotal,
      paid: paidNum,
      change: changeDue,
      cashier: activeRole === 'manager' ? 'المدير' : 'كاشير 1'
    };

    setSales([newSale, ...sales]);
    setLastSale(newSale);
    setShowReceiptModal(true);
    clearCart();
    showNotification('تم إتمام البيع بنجاح وطباعة الفاتورة!');
  };

  // Manager Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredPin === managerPin) {
      setActiveRole('manager');
      setShowLoginModal(false);
      setEnteredPin('');
      setLoginError('');
      showNotification('مرحباً بك يا مدير النظام');
    } else {
      setLoginError('كلمة المرور غير صحيحة (الافتراضية: 12345)');
    }
  };

  const switchToCashier = () => {
    setActiveRole('cashier');
    if (currentTab === 'inventory' || currentTab === 'sales' || currentTab === 'settings') {
      setCurrentTab('pos');
    }
    showNotification('تم الانتقال لوضع الكاشير');
  };

  // Product Add / Edit
  const openAddProductModal = () => {
    setEditingProduct(null);
    setProductForm({ name: '', category: 'عام', price: '', cost: '', stock: '', barcode: Math.floor(1000 + Math.random() * 9000).toString() });
    setShowProductModal(true);
  };

  const openEditProductModal = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      category: product.category,
      price: product.price.toString(),
      cost: product.cost.toString(),
      stock: product.stock.toString(),
      barcode: product.barcode
    });
    setShowProductModal(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name || productForm.price === '' || productForm.stock === '') {
      alert('يرجى ملء الحقول الأساسية بدقة.');
      return;
    }

    const priceNum = parseFloat(productForm.price);
    const costNum = parseFloat(productForm.cost) || 0;
    const stockNum = parseInt(productForm.stock) || 0;

    if (isNaN(priceNum) || priceNum < 0) {
      alert('سعر البيع غير صالح.');
      return;
    }

    if (editingProduct) {
      setProducts(products.map(p => p.id === editingProduct.id ? {
        ...p,
        name: productForm.name,
        category: productForm.category,
        price: priceNum,
        cost: costNum,
        stock: stockNum,
        barcode: productForm.barcode.trim() || p.barcode
      } : p));
      showNotification('تم تحديث بيانات المنتج بنجاح');
    } else {
      const newProd: Product = {
        id: 'P-' + Date.now(),
        name: productForm.name,
        category: productForm.category,
        price: priceNum,
        cost: costNum,
        stock: stockNum,
        barcode: productForm.barcode.trim() || Math.floor(1000 + Math.random() * 9000).toString()
      };
      setProducts([...products, newProd]);
      showNotification('تم إضافة المنتج الجديد للمخزون بنجاح');
    }
    setShowProductModal(false);
  };

  const handleDeleteProduct = (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا المنتج نهائياً؟')) {
      setProducts(products.filter(p => p.id !== id));
      showNotification('تم حذف المنتج');
    }
  };

  // Change Password
  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (oldPin !== managerPin) {
      setPasswordMessage({ text: 'كلمة المرور القديمة غير صحيحة', type: 'error' });
      return;
    }
    if (!newPin || newPin.length < 4) {
      setPasswordMessage({ text: 'كلمة المرور الجديدة يجب أن تكون 4 أرقام على الأقل', type: 'error' });
      return;
    }
    if (newPin !== confirmPin) {
      setPasswordMessage({ text: 'كلمة المرور الجديدة غير متطابقة مع التأكيد', type: 'error' });
      return;
    }
    setManagerPin(newPin);
    setOldPin('');
    setNewPin('');
    setConfirmPin('');
    setPasswordMessage({ text: 'تم تغيير كلمة المرور بنجاح!', type: 'success' });
    setTimeout(() => setPasswordMessage(null), 4000);
  };

  const handleResetData = () => {
    if (confirm('هل تريد تفريغ جميع المنتجات وجعل المتجر فارغاً تماماً؟')) {
      setProducts([]);
      setSales([]);
      showNotification('تم إفريغ المتجر بالكامل بنجاح.');
    }
  };

  const handleExportBackup = () => {
    const backupData = { products, sales, managerPin };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `smart-pos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showNotification('تم تصدير نسخة الاحتياط بنجاح');
  };

  // Export 100% Identical Replicable Standalone Offline Application HTML File WITH ZXing Camera Barcode Scanner
  const handleDownloadStandaloneApp = () => {
    const currentProductsJSON = JSON.stringify(products);
    const currentSalesJSON = JSON.stringify(sales);
    const currentPin = managerPin;

    const fullAppHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>النظام الشامل للمتجر - تطبيق نقاط البيع والمخزون بالكاميرا</title>
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <script type="text/javascript" src="https://unpkg.com/@zxing/library@latest"></script>
    <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;900&display=swap" rel="stylesheet">
    <style>
      body { font-family: 'Tajawal', sans-serif; background-color: #F8F6F0; color: #2C352D; }
      @media print {
        body * { visibility: hidden; }
        #printable-receipt, #printable-receipt * { visibility: visible; }
        #printable-receipt { position: absolute; left: 0; top: 0; width: 100%; padding: 10px; }
      }
    </style>
</head>
<body class="min-h-screen flex flex-col">
    <div id="root" class="flex-1 flex flex-col"></div>

    <script>
      let state = {
        role: 'manager',
        tab: 'pos',
        products: JSON.parse(localStorage.getItem('standalone_pos_products') || '${currentProductsJSON.replace(/'/g, "\\'")}'),
        sales: JSON.parse(localStorage.getItem('standalone_pos_sales') || '${currentSalesJSON.replace(/'/g, "\\'")}'),
        pin: localStorage.getItem('standalone_pos_pin') || '${currentPin}',
        cart: [],
        search: '',
        category: 'الكل',
        discount: '',
        paid: '',
        lastSale: null,
        showReceipt: false,
        showLogin: false,
        pinInput: '',
        showProductModal: false,
        editingProduct: null,
        form: { name: '', category: 'عام', price: '', cost: '', stock: '', barcode: '' },
        inventorySearch: '',
        toast: null,
        showScanner: false,
        scannerTarget: 'pos',
        cameraGranted: false,
        scannerErr: null
      };

      let codeReader = null;

      function showToast(msg) {
        state.toast = msg;
        render();
        setTimeout(() => { state.toast = null; render(); }, 3500);
      }

      function saveState() {
        localStorage.setItem('standalone_pos_products', JSON.stringify(state.products));
        localStorage.setItem('standalone_pos_sales', JSON.stringify(state.sales));
        localStorage.setItem('standalone_pos_pin', state.pin);
        render();
      }

      function render() {
        const root = document.getElementById('root');
        const cats = ['الكل', ...Array.from(new Set(state.products.map(p => p.category)))];
        const filtered = state.products.filter(p => (p.name.toLowerCase().includes(state.search.toLowerCase()) || p.barcode.includes(state.search)) && (state.category === 'الكل' || p.category === state.category));
        const filteredInv = state.products.filter(p => p.name.toLowerCase().includes(state.inventorySearch.toLowerCase()) || p.barcode.includes(state.inventorySearch));
        const sub = state.cart.reduce((s, i) => s + (i.price * i.quantity), 0);
        const disc = parseFloat(state.discount) || 0;
        const total = Math.max(0, sub - disc);
        const paidNum = state.paid !== '' ? parseFloat(state.paid) : total;
        const change = Math.max(0, paidNum - total);
        const totalRev = state.sales.reduce((s, x) => s + x.total, 0);
        const totalItems = state.sales.reduce((s, x) => s + x.items.reduce((a, b) => a + b.quantity, 0), 0);
        const totalProfit = state.sales.reduce((sum, s) => sum + s.items.reduce((iSum, item) => {
          const prod = state.products.find(p => p.id === item.id);
          return iSum + ((item.price - (prod ? prod.cost : 0)) * item.quantity);
        }, 0), 0);

        root.innerHTML = \`
          \${state.toast ? \`
            <div class="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#36502B] text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-bold border border-white/20">
              <span>🌿</span><span>\${state.toast}</span>
            </div>
          \` : ''}

          <header class="bg-[#557A46] text-white shadow-md sticky top-0 z-30">
            <div class="max-w-7xl mx-auto px-4 py-3 flex flex-wrap justify-between items-center gap-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-2xl">🏪</div>
                <div>
                  <h1 class="text-xl font-bold">النظام الشامل للمتجر (أوفلاين بالكاميرا)</h1>
                  <p class="text-xs text-[#E3EDDC]">يعمل بالكامل بدون انترنت (الدينار الجزائري)</p>
                </div>
              </div>
              <nav class="flex items-center gap-2 bg-[#446237] p-1.5 rounded-xl">
                <button onclick="setTab('pos')" class="px-4 py-2 rounded-lg text-sm font-medium \${state.tab === 'pos' ? 'bg-white text-[#557A46]' : 'text-white'}">نقاط البيع (POS)</button>
                \${state.role === 'manager' ? \`
                  <button onclick="setTab('inventory')" class="px-4 py-2 rounded-lg text-sm font-medium \${state.tab === 'inventory' ? 'bg-white text-[#557A46]' : 'text-white'}">المخزون</button>
                  <button onclick="setTab('sales')" class="px-4 py-2 rounded-lg text-sm font-medium \${state.tab === 'sales' ? 'bg-white text-[#557A46]' : 'text-white'}">سجل المبيعات</button>
                  <button onclick="setTab('settings')" class="px-4 py-2 rounded-lg text-sm font-medium \${state.tab === 'settings' ? 'bg-white text-[#557A46]' : 'text-white'}">الإعدادات</button>
                \` : ''}
              </nav>
              <div>
                \${state.role === 'cashier' ? \`
                  <button onclick="openLogin()" class="bg-white/20 px-3 py-1.5 rounded-lg text-sm font-bold">دخول المدير</button>
                \` : \`
                  <button onclick="setRole('cashier')" class="bg-red-500 px-3 py-1.5 rounded-lg text-sm font-bold text-white">خروج للكاشير</button>
                \`}
              </div>
            </div>
          </header>

          <main class="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">
            \${state.tab === 'pos' ? \`
              <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div class="lg:col-span-7 flex flex-col gap-4">
                  <div class="bg-white p-4 rounded-2xl shadow-sm border border-[#EBE8E0] flex flex-wrap gap-3 items-center justify-between">
                    <input type="text" placeholder="بحث عن منتج بالاسم..." oninput="setSearch(this.value)" value="\${state.search}" class="flex-1 px-4 py-2 bg-[#F8F6F0] border rounded-xl text-sm focus:outline-none" />
                    <button onclick="openScanner('pos')" class="bg-[#7EA16B] text-white px-3.5 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5">📷 ماسح الكاميرا</button>
                  </div>
                  <div class="flex gap-2 overflow-x-auto pb-1">
                    \${cats.map(c => \`
                      <button onclick="setCategory('\${c}')" class="px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap \${state.category === c ? 'bg-[#557A46] text-white' : 'bg-white text-gray-600'}">\${c}</button>
                    \`).join('')}
                  </div>
                  <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto max-h-[calc(100vh-280px)]">
                    \${filtered.map(p => \`
                      <div onclick="addToCart('\${p.id}')" class="bg-white p-4 rounded-2xl border cursor-pointer hover:border-[#7EA16B] flex flex-col justify-between gap-2 shadow-xs">
                        <div>
                          <span class="text-xs bg-[#F3EFEA] text-[#557A46] px-2 py-0.5 rounded">\${p.category}</span>
                          <h3 class="font-bold text-gray-800 mt-2">\${p.name}</h3>
                        </div>
                        <div class="flex justify-between items-end border-t pt-2">
                          <span class="text-[#557A46] font-extrabold text-lg">\${p.price} دج</span>
                          <span class="text-xs text-gray-500">متبقي: \${p.stock}</span>
                        </div>
                      </div>
                    \`).join('')}
                    \${filtered.length === 0 ? '<div class="col-span-full py-12 text-center text-gray-400 bg-white rounded-2xl border border-dashed">لا توجد منتجات. أضف منتجات من قسم المخزون.</div>' : ''}
                  </div>
                </div>

                <div class="lg:col-span-5 bg-white rounded-2xl shadow-sm border p-4 flex flex-col h-[calc(100vh-140px)] sticky top-20">
                  <div class="flex justify-between border-b pb-3 mb-3 bg-[#F8F6F0] p-3 rounded-t-xl">
                    <h3 class="font-bold">سلة المبيعات الحالية</h3>
                    \${state.cart.length > 0 ? '<button onclick="clearCart()" class="text-red-500 text-xs">إفراغ السلة</button>' : ''}
                  </div>
                  <div class="flex-1 overflow-y-auto space-y-2">
                    \${state.cart.map(i => \`
                      <div class="flex justify-between items-center bg-[#F8F6F0] p-3 rounded-xl border">
                        <div>
                          <h4 class="font-bold text-sm">\${i.name}</h4>
                          <span class="text-xs text-[#557A46]">\${i.price} دج للقطعة</span>
                        </div>
                        <div class="flex items-center gap-2">
                          <button onclick="changeQty('\${i.id}', -1)" class="px-2 py-1 bg-white border rounded font-bold">-</button>
                          <span class="font-bold text-sm">\${i.quantity}</span>
                          <button onclick="changeQty('\${i.id}', 1)" class="px-2 py-1 bg-white border rounded font-bold">+</button>
                          <button onclick="removeFromCart('\${i.id}')" class="text-red-400 text-xs">حذف</button>
                        </div>
                      </div>
                    \`).join('')}
                    \${state.cart.length === 0 ? '<div class="h-full flex items-center justify-center text-gray-400 text-sm">السلة فارغة</div>' : ''}
                  </div>
                  \${state.cart.length > 0 ? \`
                    <div class="border-t pt-3 space-y-2 bg-[#F8F6F0] p-3 rounded-b-xl">
                      <div class="flex justify-between text-sm"><span>المجموع:</span><span>\${sub.toFixed(2)} دج</span></div>
                      <div class="flex justify-between items-center text-sm"><span>خصم:</span><input type="number" value="\${state.discount}" oninput="setDiscount(this.value)" class="w-20 px-2 py-1 border rounded text-right" /></div>
                      <div class="flex justify-between text-lg font-black text-[#557A46]"><span>الإجمالي:</span><span>\${total.toFixed(2)} دج</span></div>
                      <div class="flex justify-between items-center text-sm"><span>المدفوع:</span><input type="number" value="\${state.paid}" oninput="setPaid(this.value)" placeholder="\${total}" class="w-24 px-2 py-1 border rounded text-right font-bold" /></div>
                      \${paidNum >= total ? \`<div class="flex justify-between text-xs font-bold text-green-700 bg-green-50 p-1.5 rounded"><span>المتبقي:</span><span>\${change.toFixed(2)} دج</span></div>\` : ''}
                      <button onclick="checkout()" class="w-full bg-[#557A46] text-white py-3 rounded-xl font-bold shadow">إتمام البيع وطباعة الفاتورة</button>
                    </div>
                  \` : ''}
                </div>
              </div>
            \` : ''}

            \${state.tab === 'inventory' && state.role === 'manager' ? \`
              <div class="space-y-6">
                <div class="bg-white p-4 rounded-2xl shadow-sm border flex justify-between items-center">
                  <h2 class="font-bold text-lg">إدارة المخزون والمنتجات</h2>
                  <button onclick="openProductModal()" class="bg-[#557A46] text-white px-4 py-2 rounded-xl text-sm font-bold">إضافة منتج جديد</button>
                </div>
                <div class="bg-white rounded-2xl shadow-sm border overflow-hidden">
                  <table class="w-full text-right">
                    <tr class="bg-[#F8F6F0] text-xs text-gray-600 border-b">
                      <th class="p-3">الباركود</th><th class="p-3">الاسم</th><th class="p-3">التصنيف</th><th class="p-3">التكلفة</th><th class="p-3">سعر البيع</th><th class="p-3">المخزون</th><th class="p-3 text-center">إجراءات</th>
                    </tr>
                    \${state.products.map(p => \`
                      <tr class="border-b hover:bg-[#FAF9F5]">
                        <td class="p-3 text-xs text-gray-500">#\${p.barcode}</td>
                        <td class="p-3 font-bold">\${p.name}</td>
                        <td class="p-3"><span class="bg-[#F3EFEA] px-2 py-1 rounded text-xs">\${p.category}</span></td>
                        <td class="p-3 text-gray-500">\${p.cost} دج</td>
                        <td class="p-3 font-bold text-[#557A46]">\${p.price} دج</td>
                        <td class="p-3">\${p.stock} قطعة</td>
                        <td class="p-3 text-center flex justify-center gap-2">
                          <button onclick="editProduct('\${p.id}')" class="p-1.5 bg-blue-50 text-blue-600 rounded text-xs font-bold">تعديل</button>
                          <button onclick="deleteProduct('\${p.id}')" class="p-1.5 bg-red-50 text-red-600 rounded text-xs font-bold">حذف</button>
                        </td>
                      </tr>
                    \`).join('')}
                    \${state.products.length === 0 ? '<tr><td colspan="7" class="py-12 text-center text-gray-400">المتجر خالي. انقر على إضافة منتج جديد.</td></tr>' : ''}
                  </table>
                </div>
              </div>
            \` : ''}

            \${state.tab === 'sales' && state.role === 'manager' ? \`
              <div class="space-y-6">
                <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div class="bg-white p-5 rounded-2xl shadow-sm border"><p class="text-xs text-gray-500">إجمالي المبيعات</p><h3 class="text-xl font-bold text-gray-800 mt-1">\${totalRev.toFixed(2)} دج</h3></div>
                  <div class="bg-white p-5 rounded-2xl shadow-sm border"><p class="text-xs text-gray-500">إجمالي الأرباح</p><h3 class="text-xl font-bold text-[#557A46] mt-1">\${totalProfit.toFixed(2)} دج</h3></div>
                  <div class="bg-white p-5 rounded-2xl shadow-sm border"><p class="text-xs text-gray-500">عدد الفواتير</p><h3 class="text-xl font-bold text-gray-800 mt-1">\${state.sales.length}</h3></div>
                  <div class="bg-white p-5 rounded-2xl shadow-sm border"><p class="text-xs text-gray-500">القطع المباعة</p><h3 class="text-xl font-bold text-gray-800 mt-1">\${totalItems}</h3></div>
                </div>
                <div class="bg-white rounded-2xl shadow-sm border p-4">
                  <h3 class="font-bold mb-3">سجل المبيعات</h3>
                  <table class="w-full text-right">
                    <tr class="bg-[#F8F6F0] text-xs border-b"><th class="p-3">رقم الفاتورة</th><th class="p-3">التاريخ</th><th class="p-3">الأصناف</th><th class="p-3">الإجمالي</th><th class="p-3 text-center">الإيصال</th></tr>
                    \${state.sales.map(s => \`
                      <tr class="border-b">
                        <td class="p-3 font-bold text-[#557A46]">\${s.id}</td>
                        <td class="p-3 text-xs text-gray-500">\${s.date}</td>
                        <td class="p-3">\${s.items.reduce((a, b) => a + b.quantity, 0)} قطعة</td>
                        <td class="p-3 font-bold">\${s.total.toFixed(2)} دج</td>
                        <td class="p-3 text-center"><button onclick="viewReceipt('\${s.id}')" class="px-2.5 py-1 bg-[#F3EFEA] text-[#557A46] rounded text-xs font-bold">عرض</button></td>
                      </tr>
                    \`).join('')}
                  </table>
                </div>
              </div>
            \` : ''}

            \${state.tab === 'settings' && state.role === 'manager' ? \`
              <div class="max-w-xl mx-auto bg-white p-6 rounded-2xl shadow-sm border space-y-4">
                <h3 class="font-bold text-lg">الإعدادات</h3>
                <div class="p-4 bg-[#F8F6F0] rounded-xl space-y-2">
                   <p class="text-sm font-bold">تغيير كلمة مرور المدير</p>
                   <input type="password" id="new-pin-in" placeholder="كلمة المرور الجديدة" class="w-full px-3 py-2 border rounded-xl text-sm" />
                   <button onclick="updatePin()" class="bg-[#557A46] text-white px-4 py-2 rounded-xl text-sm font-bold">حفظ كلمة المرور</button>
                </div>
                <button onclick="resetStore()" class="w-full bg-red-50 text-red-600 px-4 py-2.5 rounded-xl text-sm font-bold border border-red-200">تفريغ المتجر بالكامل</button>
              </div>
            \` : ''}
          </main>

          \${state.showScanner ? \`
            <div class="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
              <div class="bg-white w-full max-w-md rounded-3xl overflow-hidden flex flex-col">
                <div class="p-4 bg-[#557A46] text-white flex justify-between items-center">
                  <h3 class="font-bold">مسح الباركود بالكاميرا</h3>
                  <button onclick="closeScanner()" class="text-white">✕</button>
                </div>
                <div class="p-6 bg-gray-900 flex flex-col items-center gap-4">
                  \${!state.cameraGranted ? \`
                    <div class="p-6 bg-white rounded-2xl text-center space-y-3">
                      <h4 class="font-bold text-lg">تصريح استخدام الكاميرا مطلوب</h4>
                      <p class="text-xs text-gray-600">يرجى الموافقة على السماح بالوصول للكاميرا.</p>
                      <button onclick="grantCamera()" class="w-full bg-[#557A46] text-white py-2.5 rounded-xl font-bold text-sm">السماح للكاميرا</button>
                    </div>
                  \` : \`
                    <div class="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden border-2 border-[#7EA16B]">
                      <video id="cam-video" class="w-full h-full object-cover"></video>
                    </div>
                  \`}
                  \${state.scannerErr ? \`<div class="text-red-300 text-xs">\${state.scannerErr}</div>\` : ''}
                </div>
              </div>
            </div>
          \` : ''}

          \${state.showLogin ? \`
            <div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div class="bg-white p-6 rounded-2xl w-full max-w-sm space-y-3">
                <h3 class="font-bold">دخول المدير</h3>
                <input type="password" id="pin-field" placeholder="كلمة المرور (الافتراضية: 12345)" class="w-full px-3 py-2 border rounded-xl text-center font-bold tracking-widest" />
                <div class="flex justify-end gap-2">
                  <button onclick="state.showLogin = false; render();" class="px-3 py-1 text-sm">إلغاء</button>
                  <button onclick="doLogin()" class="bg-[#557A46] text-white px-4 py-1.5 rounded-xl text-sm font-bold">دخول</button>
                </div>
              </div>
            </div>
          \` : ''}

          \${state.showProductModal ? \`
            <div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div class="bg-white p-6 rounded-2xl w-full max-w-md space-y-3">
                <h3 class="font-bold">\${state.editingProduct ? 'تعديل المنتج' : 'إضافة منتج جديد'}</h3>
                <input type="text" id="m-name" value="\${state.form.name}" placeholder="اسم المنتج" class="w-full px-3 py-2 border rounded-xl text-sm" />
                <input type="text" id="m-cat" value="\${state.form.category}" placeholder="التصنيف" class="w-full px-3 py-2 border rounded-xl text-sm" />
                <div class="flex gap-2">
                  <input type="text" id="m-bar" value="\${state.form.barcode}" placeholder="الباركود" class="w-full px-3 py-2 border rounded-xl text-sm" />
                  <button onclick="openScanner('product_form')" class="bg-[#7EA16B] text-white px-3 py-2 rounded-xl text-xs font-medium shrink-0">📷 كاميرا</button>
                </div>
                <input type="number" id="m-price" value="\${state.form.price}" placeholder="سعر البيع (دج)" class="w-full px-3 py-2 border rounded-xl text-sm" />
                <input type="number" id="m-cost" value="\${state.form.cost}" placeholder="سعر التكلفة (دج)" class="w-full px-3 py-2 border rounded-xl text-sm" />
                <input type="number" id="m-stock" value="\${state.form.stock}" placeholder="الكمية" class="w-full px-3 py-2 border rounded-xl text-sm" />
                <div class="flex justify-end gap-2 pt-2">
                  <button onclick="state.showProductModal = false; render();" class="px-3 py-1 text-sm">إلغاء</button>
                  <button onclick="saveProduct()" class="bg-[#557A46] text-white px-4 py-1.5 rounded-xl text-sm font-bold">حفظ</button>
                </div>
              </div>
            </div>
          \` : ''}

          \${state.showReceipt && state.lastSale ? \`
            <div class="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
              <div class="bg-white w-full max-w-sm rounded-2xl p-6 space-y-4 font-mono">
                <div class="text-center pb-3 border-b border-dashed">
                  <h2 class="font-bold text-lg">النظام الشامل للمتجر</h2>
                  <p class="text-xs text-gray-500">\${state.lastSale.date}</p>
                  <p class="text-xs text-gray-500">فاتورة: \${state.lastSale.id}</p>
                </div>
                <div class="space-y-1 text-xs pb-3 border-b border-dashed">
                  \${state.lastSale.items.map(i => \`
                    <div class="flex justify-between"><span>\${i.name} (\${i.quantity})</span><span>\${(i.quantity * i.price).toFixed(2)} دج</span></div>
                  \`).join('')}
                </div>
                <div class="text-sm font-bold flex justify-between pt-1"><span>الإجمالي:</span><span>\${state.lastSale.total.toFixed(2)} دج</span></div>
                <button onclick="window.print()" class="w-full bg-[#557A46] text-white py-2 rounded-xl font-bold text-sm">طباعة</button>
                <button onclick="state.showReceipt = false; render();" class="w-full bg-gray-200 py-2 rounded-xl text-sm">إغلاق</button>
              </div>
            </div>
          \` : ''}
        \`;
      }

      function setTab(t) { state.tab = t; render(); }
      function setRole(r) { state.role = r; render(); }
      function setSearch(s) { state.search = s; render(); }
      function setCategory(c) { state.category = c; render(); }
      function setDiscount(d) { state.discount = d === '' ? '' : parseFloat(d); render(); }
      function setPaid(p) { state.paid = p === '' ? '' : parseFloat(p); render(); }
      function openLogin() { state.showLogin = true; render(); }
      function doLogin() {
        const pin = document.getElementById('pin-field').value;
        if (pin === state.pin) {
          state.role = 'manager';
          state.showLogin = false;
          showToast('مرحباً بك يا مدير');
        } else {
          alert('كلمة المرور غير صحيحة');
        }
      }

      function openScanner(target) {
        state.scannerTarget = target;
        state.showScanner = true;
        state.cameraGranted = false;
        state.scannerErr = null;
        render();
      }

      function grantCamera() {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
          .then(stream => {
            stream.getTracks().forEach(t => t.stop());
            state.cameraGranted = true;
            render();
            setTimeout(() => startZXingScanner(), 200);
          })
          .catch(err => {
            state.scannerErr = 'تعذر الوصول للكاميرا. تأكد من إعطاء الإذن.';
            render();
          });
      }

      function startZXingScanner() {
        const videoEl = document.getElementById('cam-video');
        if (!videoEl) return;
        codeReader = new ZXing.BrowserMultiFormatReader();
        codeReader.decodeFromVideoDevice(null, videoEl, (result, err) => {
          if (result) {
            handleScannedCode(result.getText());
          }
        }).catch(e => {
          state.scannerErr = 'خطأ في تشغيل الماسح';
          render();
        });
      }

      function handleScannedCode(code) {
        if (codeReader) codeReader.reset();
        state.showScanner = false;
        render();

        if (state.scannerTarget === 'pos') {
          const p = state.products.find(x => x.barcode === code);
          if (p) {
            addToCart(p.id);
            showToast('تمت إضافة: ' + p.name);
          } else {
            showToast('لم يُعثر على منتج بالباركود: ' + code);
          }
        } else if (state.scannerTarget === 'product_form') {
          const barInput = document.getElementById('m-bar');
          if (barInput) barInput.value = code;
          state.form.barcode = code;
          showToast('تم التقاط الباركود بنجاح');
        }
      }

      function closeScanner() {
        if (codeReader) codeReader.reset();
        state.showScanner = false;
        render();
      }

      function addToCart(id) {
        const p = state.products.find(x => x.id === id);
        if (!p || p.stock <= 0) return showToast('المنتج نفد من المخزون');
        const ex = state.cart.find(i => i.id === id);
        if (ex) {
          if (ex.quantity >= p.stock) return showToast('تجاوزت المخزون المتاح');
          ex.quantity++;
        } else {
          state.cart.push({ ...p, quantity: 1 });
        }
        render();
      }
      function changeQty(id, d) {
        const i = state.cart.find(x => x.id === id);
        if (!i) return;
        i.quantity += d;
        if (i.quantity <= 0) state.cart = state.cart.filter(x => x.id !== id);
        render();
      }
      function removeFromCart(id) { state.cart = state.cart.filter(x => x.id !== id); render(); }
      function clearCart() { state.cart = []; state.discount = ''; state.paid = ''; render(); }
      
      function checkout() {
        const sub = state.cart.reduce((s, i) => s + (i.price * i.quantity), 0);
        const total = Math.max(0, sub - (parseFloat(state.discount) || 0));
        const paid = state.paid !== '' ? parseFloat(state.paid) : total;
        if (paid < total) return alert('المبلغ المدفوع غير كافٍ');

        state.products = state.products.map(p => {
          const c = state.cart.find(i => i.id === p.id);
          return c ? { ...p, stock: Math.max(0, p.stock - c.quantity) } : p;
        });

        const sale = {
          id: 'INV-' + Math.floor(100000 + Math.random() * 900000),
          date: new Date().toLocaleString('ar-SA'),
          items: [...state.cart],
          subtotal: sub,
          discount: parseFloat(state.discount) || 0,
          total,
          paid,
          change: paid - total,
          cashier: state.role === 'manager' ? 'المدير' : 'كاشير'
        };

        state.sales.unshift(sale);
        state.lastSale = sale;
        state.showReceipt = true;
        state.cart = [];
        state.discount = '';
        state.paid = '';
        saveState();
        showToast('تم إتمام البيع بنجاح');
      }

      function openProductModal() {
        state.editingProduct = null;
        state.form = { name: '', category: 'عام', price: '', cost: '', stock: '', barcode: Math.floor(1000 + Math.random() * 9000).toString() };
        state.showProductModal = true;
        render();
      }

      function editProduct(id) {
        const p = state.products.find(x => x.id === id);
        if (!p) return;
        state.editingProduct = p;
        state.form = { name: p.name, category: p.category, price: p.price.toString(), cost: p.cost.toString(), stock: p.stock.toString(), barcode: p.barcode };
        state.showProductModal = true;
        render();
      }

      function saveProduct() {
        const name = document.getElementById('m-name').value;
        const category = document.getElementById('m-cat').value || 'عام';
        const price = parseFloat(document.getElementById('m-price').value);
        const cost = parseFloat(document.getElementById('m-cost').value) || 0;
        const stock = parseInt(document.getElementById('m-stock').value);
        const barcode = document.getElementById('m-bar').value || Math.floor(1000 + Math.random() * 9000).toString();

        if (!name || isNaN(price) || isNaN(stock)) return alert('يرجى ملء الحقول المطلوبة');

        if (state.editingProduct) {
          state.products = state.products.map(p => p.id === state.editingProduct.id ? { ...p, name, category, price, cost, stock, barcode } : p);
        } else {
          state.products.push({
            id: 'P-' + Date.now(),
            name,
            category,
            price,
            cost,
            stock,
            barcode
          });
        }
        state.showProductModal = false;
        saveState();
        showToast('تم الحفظ بنجاح');
      }

      function deleteProduct(id) {
        if (confirm('هل أنت متأكد من الحذف؟')) {
          state.products = state.products.filter(p => p.id !== id);
          saveState();
          showToast('تم الحذف');
        }
      }

      function viewReceipt(id) {
        state.lastSale = state.sales.find(s => s.id === id);
        state.showReceipt = true;
        render();
      }

      function updatePin() {
        const np = document.getElementById('new-pin-in').value;
        if (!np || np.length < 4) return alert('كلمة المرور يجب أن تكون 4 أرقام على الأقل');
        state.pin = np;
        saveState();
        showToast('تم تغيير كلمة المرور بنجاح');
      }

      function resetStore() {
        if (confirm('هل تريد تفريغ المتجر بالكامل؟')) {
          state.products = [];
          state.sales = [];
          saveState();
          showToast('تم تفريغ المتجر');
        }
      }

      render();
    </script>
</body>
</html>`;

    const blob = new Blob([fullAppHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'smart-store-pos-app.html';
    link.click();
    URL.revokeObjectURL(url);
    showNotification('تم تحميل تطبيق المتجر المطابق بالكاميرا بنجاح!');
  };

  // Financial Stats
  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const totalItemsSold = sales.reduce((sum, s) => sum + s.items.reduce((iSum, item) => iSum + item.quantity, 0), 0);
  const totalCost = sales.reduce((sum, s) => {
    return sum + s.items.reduce((itemSum, item) => {
      const prod = products.find(p => p.id === item.id);
      return itemSum + ((prod ? prod.cost : 0) * item.quantity);
    }, 0);
  }, 0);
  const totalProfit = totalRevenue - totalCost;
  const lowStockCount = products.filter(p => p.stock <= 5).length;

  return (
    <div className="min-h-screen bg-[#F8F6F0] text-[#2C352D] flex flex-col font-sans">
      
      {/* Notification Toast Banner */}
      {notificationBanner && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#36502B] text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-bold border border-white/20 animate-bounce">
          <span>🌿</span>
          <span>{notificationBanner}</span>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="bg-[#557A46] text-white shadow-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap justify-between items-center gap-4">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-2xl shadow-inner">
              🏪
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-wide">النظام الشامل للمتجر</h1>
              <p className="text-xs text-[#E3EDDC]">نظام نقاط البيع وإدارة المخزون (د.ج)</p>
            </div>
          </div>

          <nav className="flex items-center gap-2 bg-[#446237] p-1.5 rounded-xl">
            <button 
              onClick={() => setCurrentTab('pos')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition ${currentTab === 'pos' ? 'bg-white text-[#557A46] shadow' : 'text-white hover:bg-white/10'}`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>نقاط البيع (POS)</span>
            </button>

            {activeRole === 'manager' && (
              <>
                <button 
                  onClick={() => setCurrentTab('inventory')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition relative ${currentTab === 'inventory' ? 'bg-white text-[#557A46] shadow' : 'text-white hover:bg-white/10'}`}
                >
                  <Package className="w-4 h-4" />
                  <span>المخزون</span>
                  {lowStockCount > 0 && (
                    <span className="absolute -top-1.5 -left-1.5 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">
                      {lowStockCount}
                    </span>
                  )}
                </button>

                <button 
                  onClick={() => setCurrentTab('sales')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition ${currentTab === 'sales' ? 'bg-white text-[#557A46] shadow' : 'text-white hover:bg-white/10'}`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>سجل المبيعات</span>
                </button>

                <button 
                  onClick={() => setCurrentTab('settings')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition ${currentTab === 'settings' ? 'bg-white text-[#557A46] shadow' : 'text-white hover:bg-white/10'}`}
                >
                  <Settings className="w-4 h-4" />
                  <span>الإعدادات</span>
                </button>
              </>
            )}
          </nav>

          <div className="flex items-center gap-3">
            {activeRole === 'cashier' ? (
              <div className="flex items-center gap-2 bg-[#446237] px-3 py-1.5 rounded-lg text-sm">
                <User className="w-4 h-4 text-[#C1D7B4]" />
                <span>العامل (كاشير)</span>
                <button 
                  onClick={() => setShowLoginModal(true)}
                  className="ml-2 bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded text-xs transition flex items-center gap-1"
                >
                  <Lock className="w-3 h-3" />
                  <span>دخول المدير</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-[#36502B] px-3 py-1.5 rounded-lg text-sm border border-white/20">
                <Shield className="w-4 h-4 text-amber-300" />
                <span className="font-bold">المدير (صلاحيات كاملة)</span>
                <button 
                  onClick={switchToCashier}
                  className="ml-2 bg-red-500/80 hover:bg-red-600 px-2.5 py-1 rounded text-xs transition flex items-center gap-1 text-white"
                >
                  <LogOut className="w-3 h-3" />
                  <span>خروج للـكاشير</span>
                </button>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">

        {/* ===================== TAB 1: POS (نقاط البيع) ===================== */}
        {currentTab === 'pos' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Product Catalog */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              
              {/* Search, Barcode & Camera Scan Button */}
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-[#EBE8E0] flex flex-wrap gap-3 items-center justify-between">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute right-3.5 top-3 w-4 h-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="بحث عن منتج بالاسم..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pr-10 pl-4 py-2 bg-[#F8F6F0] border border-[#EBE8E0] rounded-xl text-sm focus:outline-none focus:border-[#7EA16B]"
                  />
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setScannerTarget('pos');
                      setCameraPermissionGranted(false);
                      setShowScannerModal(true);
                    }}
                    className="bg-[#7EA16B] hover:bg-[#6C8E5A] text-white px-3.5 py-2 rounded-xl text-sm font-medium transition flex items-center gap-1.5 shadow-xs"
                    title="مسح الباركود بالكاميرا"
                  >
                    <Camera className="w-4 h-4" />
                    <span>ماسح الكاميرا</span>
                  </button>

                  <form onSubmit={handleBarcodeSubmit} className="flex gap-1.5">
                    <input 
                      type="text" 
                      placeholder="الباركود..." 
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      className="w-28 px-3 py-2 bg-[#F8F6F0] border border-[#EBE8E0] rounded-xl text-sm focus:outline-none focus:border-[#7EA16B]"
                    />
                    <button type="submit" className="bg-[#557A46] hover:bg-[#446237] text-white px-3 py-2 rounded-xl text-sm font-medium transition">
                      إضافة
                    </button>
                  </form>
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition shadow-xs ${selectedCategory === cat ? 'bg-[#557A46] text-white' : 'bg-white text-gray-600 hover:bg-[#EBE8E0]'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Products Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
                {filteredProducts.map((product) => (
                  <div 
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className={`bg-white p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between gap-2 shadow-xs hover:shadow-md hover:border-[#7EA16B] ${product.stock <= 0 ? 'opacity-50 bg-gray-50' : ''}`}
                  >
                    <div>
                      <div className="flex justify-between items-start gap-1">
                        <span className="text-xs bg-[#F3EFEA] text-[#557A46] px-2 py-0.5 rounded-md font-medium">
                          {product.category}
                        </span>
                        <span className="text-xs text-gray-400 font-mono">#{product.barcode}</span>
                      </div>
                      <h3 className="font-bold text-gray-800 mt-2 line-clamp-2">{product.name}</h3>
                    </div>

                    <div className="flex justify-between items-end mt-2 pt-2 border-t border-gray-100">
                      <span className="text-[#557A46] font-extrabold text-lg">{product.price} دج</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${product.stock <= 5 ? 'bg-red-100 text-red-600' : 'bg-green-50 text-green-700'}`}>
                        متبقي: {product.stock}
                      </span>
                    </div>
                  </div>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="col-span-full py-16 text-center text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200 p-6 space-y-3">
                    <Package className="w-12 h-12 mx-auto text-gray-300 stroke-1" />
                    <p className="font-bold text-gray-700">المتجر فارغ حالياً. أضف منتجاتك للبدء في البيع.</p>
                    {activeRole === 'manager' && (
                      <button 
                        onClick={openAddProductModal}
                        className="bg-[#557A46] text-white px-4 py-2 rounded-xl text-sm font-bold shadow hover:bg-[#446237] transition"
                      >
                        إضافة أول منتج للمتجر
                      </button>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* Cart & Checkout Panel */}
            <div className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-[#EBE8E0] flex flex-col h-[calc(100vh-140px)] sticky top-20">
              
              <div className="p-4 border-b border-[#EBE8E0] flex justify-between items-center bg-[#F8F6F0] rounded-t-2xl">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-[#557A46]" />
                  <h2 className="font-bold text-gray-800">سلة المبيعات الحالية</h2>
                </div>
                {cart.length > 0 && (
                  <button 
                    onClick={clearCart}
                    className="text-red-500 hover:text-red-700 text-xs font-medium flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-red-200 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>إفراغ السلة</span>
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
                    <ShoppingCart className="w-12 h-12 stroke-1 text-gray-300" />
                    <p className="text-sm">السلة فارغة. اختر المنتجات للبيع.</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between bg-[#F8F6F0] p-3 rounded-xl border border-[#EBE8E0]">
                      <div className="flex-1">
                        <h4 className="font-bold text-sm text-gray-800">{item.name}</h4>
                        <span className="text-xs text-[#557A46] font-bold">{item.price} دج للقطعة</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-white rounded-lg border border-gray-200">
                          <button 
                            onClick={() => updateQuantity(item.id, -1)}
                            className="px-2 py-1 text-gray-600 hover:bg-gray-100 rounded-r-lg font-bold text-sm"
                          >
                            -
                          </button>
                          <span className="px-3 text-sm font-bold">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.id, 1)}
                            className="px-2 py-1 text-gray-600 hover:bg-gray-100 rounded-l-lg font-bold text-sm"
                          >
                            +
                          </button>
                        </div>

                        <button 
                          onClick={() => removeFromCart(item.id)}
                          className="text-red-400 hover:text-red-600 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-4 border-t border-[#EBE8E0] bg-[#F8F6F0] rounded-b-2xl space-y-3">
                  
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>المجموع الفرعي:</span>
                      <span>{subtotal.toFixed(2)} دج</span>
                    </div>

                    <div className="flex justify-between items-center text-gray-600">
                      <span>خصم إضافي:</span>
                      <input 
                        type="number" 
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0))}
                        placeholder="0"
                        className="w-24 px-2 py-1 bg-white border border-gray-300 rounded-lg text-right text-sm focus:outline-none focus:border-[#7EA16B]"
                      />
                    </div>

                    <div className="flex justify-between text-lg font-black text-[#557A46] pt-2 border-t border-gray-200">
                      <span>الإجمالي النهائي:</span>
                      <span>{finalTotal.toFixed(2)} دج</span>
                    </div>

                    <div className="flex justify-between items-center pt-1">
                      <span className="text-sm font-medium text-gray-700">المبلغ المدفوع:</span>
                      <input 
                        type="number" 
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        placeholder={finalTotal.toString()}
                        className="w-28 px-3 py-1 bg-white border border-[#7EA16B] rounded-lg text-right font-bold text-sm focus:outline-none"
                      />
                    </div>

                    {typeof amountPaid === 'number' && amountPaid >= finalTotal && (
                      <div className="flex justify-between text-sm font-bold text-green-700 bg-green-50 p-2 rounded-lg">
                        <span>المتبقي (الصافي):</span>
                        <span>{changeDue.toFixed(2)} دج</span>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={handleCheckout}
                    className="w-full bg-[#557A46] hover:bg-[#446237] text-white py-3 rounded-xl font-bold shadow transition flex items-center justify-center gap-2 text-base"
                  >
                    <CheckCircle className="w-5 h-5" />
                    <span>إتمام البيع وطباعة الفاتورة</span>
                  </button>

                </div>
              )}

            </div>

          </div>
        )}

        {/* ===================== TAB 2: INVENTORY (المخزون والمنتجات) ===================== */}
        {currentTab === 'inventory' && activeRole === 'manager' && (
          <div className="space-y-6">
            
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-[#EBE8E0] flex flex-wrap justify-between items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800">إدارة المخزون والمنتجات</h2>
                <p className="text-xs text-gray-500">المتجر خالي تماماً وجاهز لإضافة منتجاتك الخاصة بالدينار الجزائري (دج)</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={inventoryCategoryFilter}
                  onChange={(e) => setInventoryCategoryFilter(e.target.value)}
                  className="px-3 py-2 bg-[#F8F6F0] border border-[#EBE8E0] rounded-xl text-sm focus:outline-none focus:border-[#7EA16B]"
                >
                  {categories.map(c => <option key={c} value={c}>تصنيف: {c}</option>)}
                </select>

                <div className="relative">
                  <Search className="absolute right-3.5 top-2.5 w-4 h-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="بحث في المخزون..." 
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    className="pr-10 pl-4 py-2 bg-[#F8F6F0] border border-[#EBE8E0] rounded-xl text-sm focus:outline-none focus:border-[#7EA16B]"
                  />
                </div>

                <button 
                  onClick={openAddProductModal}
                  className="bg-[#557A46] hover:bg-[#446237] text-white px-4 py-2 rounded-xl font-medium text-sm flex items-center gap-2 transition shadow whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة منتج جديد</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-[#EBE8E0] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-[#F8F6F0] border-b border-[#EBE8E0] text-gray-600 text-xs font-bold">
                      <th className="p-4">الباركود</th>
                      <th className="p-4">اسم المنتج</th>
                      <th className="p-4">التصنيف</th>
                      <th className="p-4">سعر التكلفة</th>
                      <th className="p-4">سعر البيع</th>
                      <th className="p-4">المخزون الحالي</th>
                      <th className="p-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {filteredInventoryProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-[#FAF9F5] transition">
                        <td className="p-4 font-mono text-gray-500 text-xs">#{product.barcode}</td>
                        <td className="p-4 font-bold text-gray-800">{product.name}</td>
                        <td className="p-4">
                          <span className="bg-[#F3EFEA] text-[#557A46] px-2.5 py-1 rounded-lg text-xs font-medium">
                            {product.category}
                          </span>
                        </td>
                        <td className="p-4 text-gray-500">{product.cost} دج</td>
                        <td className="p-4 font-bold text-[#557A46]">{product.price} دج</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${product.stock <= 5 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-green-100 text-green-700'}`}>
                            {product.stock} قطعة {product.stock <= 5 && '⚠️'}
                          </span>
                        </td>
                        <td className="p-4 flex items-center justify-center gap-2">
                          <button 
                            onClick={() => openEditProductModal(product)}
                            className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                            title="تعديل"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteProduct(product.id)}
                            className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition"
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredInventoryProducts.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-16 text-center text-gray-400">
                          <Package className="w-12 h-12 mx-auto text-gray-300 stroke-1 mb-2" />
                          <p className="font-bold text-gray-600">المتجر خالي من المنتجات حالياً.</p>
                          <p className="text-xs text-gray-400 mt-1">انقر على زر "إضافة منتج جديد" أو استخدم مسح الكاميرا للبدء.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ===================== TAB 3: SALES (سجل المبيعات والأرباح) ===================== */}
        {currentTab === 'sales' && activeRole === 'manager' && (
          <div className="space-y-6">
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-[#EBE8E0] flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl font-bold">
                  💰
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">إجمالي المبيعات (الإيرادات)</p>
                  <h3 className="text-xl font-bold text-gray-800 mt-1">{totalRevenue.toFixed(2)} دج</h3>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-[#EBE8E0] flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl font-bold">
                  📈
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">إجمالي الأرباح التقديرية</p>
                  <h3 className="text-xl font-bold text-[#557A46] mt-1">{totalProfit.toFixed(2)} دج</h3>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-[#EBE8E0] flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl font-bold">
                  🧾
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">عدد الفواتير المسجلة</p>
                  <h3 className="text-xl font-bold text-gray-800 mt-1">{sales.length} فاتورة</h3>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-[#EBE8E0] flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl font-bold">
                  📦
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">القطع المباعة</p>
                  <h3 className="text-xl font-bold text-gray-800 mt-1">{totalItemsSold} قطعة</h3>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-[#EBE8E0] overflow-hidden">
              <div className="p-4 border-b border-[#EBE8E0] bg-[#F8F6F0] flex justify-between items-center">
                <h3 className="font-bold text-gray-800">سجل فواتير المبيعات التفصيلي</h3>
                {sales.length > 0 && (
                  <button 
                    onClick={() => {
                      if (confirm('هل تريد مسح سجل المبيعات بالكامل؟')) {
                        setSales([]);
                        showNotification('تم مسح سجل المبيعات');
                      }
                    }}
                    className="text-red-500 hover:text-red-700 text-xs font-bold"
                  >
                    مسح السجل
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-[#FAF9F5] border-b border-[#EBE8E0] text-gray-600 text-xs font-bold">
                      <th className="p-4">رقم الفاتورة</th>
                      <th className="p-4">التاريخ والوقت</th>
                      <th className="p-4">عدد الأصناف</th>
                      <th className="p-4">الإجمالي</th>
                      <th className="p-4">المسؤول</th>
                      <th className="p-4 text-center">عرض الفاتورة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {sales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-[#FAF9F5] transition">
                        <td className="p-4 font-mono font-bold text-[#557A46]">{sale.id}</td>
                        <td className="p-4 text-gray-600">{sale.date}</td>
                        <td className="p-4">{sale.items.reduce((s, i) => s + i.quantity, 0)} قطعة</td>
                        <td className="p-4 font-bold text-gray-900">{sale.total.toFixed(2)} دج</td>
                        <td className="p-4 text-gray-600">{sale.cashier}</td>
                        <td className="p-4 text-center">
                          <button 
                            onClick={() => {
                              setLastSale(sale);
                              setShowReceiptModal(true);
                            }}
                            className="px-3 py-1.5 bg-[#F3EFEA] hover:bg-[#E3EDDC] text-[#557A46] rounded-lg text-xs font-bold transition flex items-center gap-1.5 mx-auto shadow-xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>عرض الإيصال</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {sales.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-gray-400">
                          لا توجد مبيعات مسجلة حتى الآن.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ===================== TAB 4: SETTINGS (الإعدادات) ===================== */}
        {currentTab === 'settings' && activeRole === 'manager' && (
          <div className="max-w-2xl mx-auto space-y-6">
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#EBE8E0]">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                <Key className="w-6 h-6 text-[#557A46]" />
                <h3 className="font-bold text-lg text-gray-800">تغيير كلمة مرور المدير (PIN)</h3>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                {passwordMessage && (
                  <div className={`p-3 rounded-xl text-sm font-medium ${passwordMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {passwordMessage.text}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور الحالية</label>
                  <input 
                    type="password" 
                    value={oldPin}
                    onChange={(e) => setOldPin(e.target.value)}
                    placeholder="أدخل كلمة المرور الحالية"
                    className="w-full px-4 py-2 bg-[#F8F6F0] border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[#7EA16B]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور الجديدة</label>
                  <input 
                    type="password" 
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    placeholder="أدخل كلمة المرور الجديدة"
                    className="w-full px-4 py-2 bg-[#F8F6F0] border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[#7EA16B]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تأكيد كلمة المرور الجديدة</label>
                  <input 
                    type="password" 
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    placeholder="أعد إدخال كلمة المرور الجديدة"
                    className="w-full px-4 py-2 bg-[#F8F6F0] border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[#7EA16B]"
                  />
                </div>

                <button 
                  type="submit"
                  className="bg-[#557A46] hover:bg-[#446237] text-white px-6 py-2.5 rounded-xl font-bold text-sm transition shadow"
                >
                  حفظ كلمة المرور الجديدة
                </button>
              </form>
            </div>

            {/* Download Identical Standalone App Card */}
            <div className="bg-gradient-to-br from-[#557A46] to-[#446237] text-white p-6 rounded-2xl shadow-md space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-white/20">
                <Smartphone className="w-7 h-7 text-amber-300" />
                <div>
                  <h3 className="font-bold text-lg">تحميل تطبيق المتجر (نسخة مطابقة للموقع بالكاميرا)</h3>
                  <p className="text-xs text-[#E3EDDC]">تطبيق مستقل يضم كافة ميزات الموقع بما فيها الكاميرا والباركود</p>
                </div>
              </div>

              <p className="text-xs text-white/90 leading-relaxed">
                هذا الزر يقوم بتنزيل ملف تشغيلي واحد بصيغة `.html` يطابق الموقع بنسبة 100% من حيث الميزات (نقاط البيع، ماسح الباركود بالكاميرا، إدارة المخزون، والسلة، سجل المبيعات، حماية المدير، وطباعة الفواتير بالدينار الجزائري).
              </p>

              <button 
                onClick={handleDownloadStandaloneApp}
                className="bg-white text-[#557A46] hover:bg-[#F8F6F0] px-6 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition shadow-lg w-full sm:w-auto"
              >
                <Download className="w-4 h-4" />
                <span>تحميل التطبيق الكامل المطابق (Offline App + Camera)</span>
              </button>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#EBE8E0] space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                <Download className="w-6 h-6 text-[#557A46]" />
                <h3 className="font-bold text-lg text-gray-800">إدارة البيانات والنسخ الاحتياطي</h3>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button 
                  onClick={handleExportBackup}
                  className="bg-[#557A46] hover:bg-[#446237] text-white px-5 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 transition shadow"
                >
                  <Download className="w-4 h-4" />
                  <span>تصدير نسخة احتياطية (JSON)</span>
                </button>

                <button 
                  onClick={handleResetData}
                  className="bg-red-50 hover:bg-red-100 text-red-600 px-5 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 transition border border-red-200"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>تفريغ المتجر بالكامل</span>
                </button>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* ===================== MODALS ===================== */}

      {/* 1. Manager Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md p-6 rounded-2xl shadow-2xl border border-[#EBE8E0] space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#557A46]" />
                <h3 className="font-bold text-lg text-gray-800">تسجيل دخول المدير</h3>
              </div>
              <button onClick={() => setShowLoginModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {loginError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm font-medium">
                  {loginError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور (PIN): <span className="text-xs text-gray-400">(الافتراضية: 12345)</span></label>
                <input 
                  type="password" 
                  value={enteredPin}
                  onChange={(e) => setEnteredPin(e.target.value)}
                  placeholder="أدخل كلمة المرور"
                  autoFocus
                  className="w-full px-4 py-2.5 bg-[#F8F6F0] border border-gray-300 rounded-xl text-center text-lg tracking-widest font-bold focus:outline-none focus:border-[#7EA16B]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowLoginModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl text-sm font-medium transition"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  className="bg-[#557A46] hover:bg-[#446237] text-white px-6 py-2 rounded-xl font-bold text-sm transition shadow"
                >
                  دخول
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Add / Edit Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg p-6 rounded-2xl shadow-2xl border border-[#EBE8E0] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-800">
                {editingProduct ? 'تعديل بيانات المنتج والأسعار' : 'إضافة منتج جديد للمخزون'}
              </h3>
              <button onClick={() => setShowProductModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">اسم المنتج *</label>
                  <input 
                    type="text" 
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    placeholder="مثال: منتج جديد"
                    required
                    className="w-full px-4 py-2 bg-[#F8F6F0] border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[#7EA16B]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">التصنيف</label>
                  <input 
                    type="text" 
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    placeholder="مثال: عام"
                    required
                    className="w-full px-4 py-2 bg-[#F8F6F0] border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[#7EA16B]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الباركود</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={productForm.barcode}
                      onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                      placeholder="رقم الباركود"
                      className="w-full px-4 py-2 bg-[#F8F6F0] border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[#7EA16B]"
                    />
                    <button 
                      type="button" 
                      onClick={() => {
                        setScannerTarget('product_form');
                        setCameraPermissionGranted(false);
                        setShowScannerModal(true);
                      }}
                      className="bg-[#7EA16B] hover:bg-[#6C8E5A] text-white px-3 py-2 rounded-xl text-xs font-medium transition flex items-center gap-1 shrink-0"
                      title="مسح بالكاميرا"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">سعر التكلفة (دج)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={productForm.cost}
                    onChange={(e) => setProductForm({ ...productForm, cost: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-4 py-2 bg-[#F8F6F0] border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[#7EA16B]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">سعر البيع (دج) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    placeholder="0.00"
                    required
                    className="w-full px-4 py-2 bg-[#F8F6F0] border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[#7EA16B]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">الكمية في المخزون *</label>
                  <input 
                    type="number" 
                    value={productForm.stock}
                    onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                    placeholder="0"
                    required
                    className="w-full px-4 py-2 bg-[#F8F6F0] border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[#7EA16B]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl text-sm font-medium transition"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  className="bg-[#557A46] hover:bg-[#446237] text-white px-6 py-2 rounded-xl font-bold text-sm transition shadow"
                >
                  حفظ البيانات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Camera Barcode Scanner Modal with Clear Approval Guide */}
      {showScannerModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            
            <div className="p-4 bg-[#557A46] text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-amber-300" />
                <h3 className="font-bold text-base">مسح الباركود بالكاميرا</h3>
              </div>
              <button onClick={() => setShowScannerModal(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col items-center gap-4 bg-gray-900 relative">
              {!cameraPermissionGranted ? (
                <div className="p-6 bg-white rounded-2xl text-center space-y-4 my-4">
                  <div className="w-12 h-12 bg-emerald-100 text-[#557A46] rounded-2xl flex items-center justify-center mx-auto text-2xl font-bold">
                    📷
                  </div>
                  <h4 className="font-bold text-lg text-gray-800">تصريح استخدام الكاميرا مطلوب</h4>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    لقراءة الباركود بسرعة وسلاسة، يرجى السماح للمتصفح بالوصول إلى الكاميرا عبر النقر على الزر أدناه ثم الموافقة (Allow).
                  </p>
                  <button 
                    onClick={requestCameraAccess}
                    className="w-full bg-[#557A46] hover:bg-[#446237] text-white py-3 rounded-xl font-bold text-sm transition shadow"
                  >
                    منح صلاحية الكاميرا الآن (السماح)
                  </button>
                </div>
              ) : (
                <div className="relative w-full overflow-hidden rounded-2xl aspect-[4/3] bg-black border-2 border-[#7EA16B]">
                  <video 
                    ref={videoRef} 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 border-2 border-dashed border-[#7EA16B]/60 m-8 rounded-xl pointer-events-none flex items-center justify-center">
                    <span className="text-white text-xs bg-black/60 px-3 py-1.5 rounded-lg font-medium shadow">وجه الكاميرا نحو الباركود</span>
                  </div>
                </div>
              )}

              {scannerError && (
                <div className="p-3 bg-red-500/20 border border-red-500 text-red-200 rounded-xl text-center text-xs">
                  {scannerError}
                </div>
              )}
            </div>

            <div className="p-4 bg-white border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => setShowScannerModal(false)}
                className="w-full py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold text-sm transition"
              >
                إغلاق الكاميرا
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 4. Receipt / Bill Modal */}
      {showReceiptModal && lastSale && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-[#EBE8E0] overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-4 bg-[#557A46] text-white flex justify-between items-center">
              <h3 className="font-bold text-base">فاتورة المبيعات (إيصال)</h3>
              <button onClick={() => setShowReceiptModal(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div id="printable-receipt" className="p-6 overflow-y-auto space-y-4 text-sm bg-white font-mono">
              <div className="text-center space-y-1 pb-4 border-b border-dashed border-gray-300">
                <div className="text-2xl mb-1">🏪</div>
                <h2 className="font-black text-lg text-gray-900">النظام الشامل للمتجر</h2>
                <p className="text-xs text-gray-500">نظام نقاط البيع والمخزون</p>
                <p className="text-xs text-gray-500 mt-1">تاريخ: {lastSale.date}</p>
                <p className="text-xs text-gray-500">رقم الفاتورة: <span className="font-bold">{lastSale.id}</span></p>
                <p className="text-xs text-gray-500">الكاشير: {lastSale.cashier}</p>
              </div>

              <div className="space-y-2 pb-4 border-b border-dashed border-gray-300 text-xs">
                <div className="flex justify-between font-bold text-gray-700 border-b pb-1">
                  <span>الصنف</span>
                  <span>الكمية × السعر</span>
                  <span>الإجمالي</span>
                </div>
                {lastSale.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-gray-800">
                    <span className="truncate max-w-[120px]">{item.name}</span>
                    <span>{item.quantity} × {item.price}</span>
                    <span className="font-bold">{(item.quantity * item.price).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 text-xs pb-4 border-b border-dashed border-gray-300">
                <div className="flex justify-between text-gray-600">
                  <span>المجموع الفرعي:</span>
                  <span>{lastSale.subtotal.toFixed(2)} دج</span>
                </div>
                {lastSale.discount > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>الخصم:</span>
                    <span>-{lastSale.discount.toFixed(2)} دج</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-gray-900 pt-1">
                  <span>الإجمالي النهائي:</span>
                  <span>{lastSale.total.toFixed(2)} دج</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>المبلغ المدفوع:</span>
                  <span>{lastSale.paid.toFixed(2)} دج</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>المتبقي (الصافي):</span>
                  <span>{lastSale.change.toFixed(2)} دج</span>
                </div>
              </div>

              <div className="text-center text-xs text-gray-500 pt-2 space-y-1">
                <p>شكراً لتعاملكم معنا!</p>
              </div>
            </div>

            <div className="p-4 bg-[#F8F6F0] border-t border-[#EBE8E0] flex gap-2">
              <button 
                onClick={() => window.print()}
                className="flex-1 bg-[#557A46] hover:bg-[#446237] text-white py-2.5 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 shadow"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة الإيصال</span>
              </button>
              <button 
                onClick={() => setShowReceiptModal(false)}
                className="px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium text-sm transition"
              >
                إغلاق
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
