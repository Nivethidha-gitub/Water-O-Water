import React from "react";
import Icon from "./Icon";
import { StyleSheet, View } from "react-native";
import { Text } from "../i18n";
import { Pill, Stepper } from "./ui";
import { colors, fonts, radius, shadow } from "../theme/colors";
import { money } from "../utils/format";

export default function ProductCard({ product, qty, onChange, right }) {
  return <View style={styles.card}>
    <View style={styles.icon}><Icon name="droplet" size={30} /></View>
    <View style={{flex:1}}><Text style={styles.name}>{product.nameEn || product.name}</Text><Text style={styles.meta}>{product.stockTracked && !product.inStock ? "Currently out of stock" : product.lowStock ? `Only ${product.stockQty} left` : "Pure drinking water · Ready to deliver"}</Text><Text style={styles.price}>{money(product.unitPricePaise)} <Text style={styles.each}>/ can</Text></Text></View>
    {right ? (typeof right === "string" || typeof right === "number" ? <Text>{String(right)}</Text> : right) : product.inStock === false ? <Pill text="Out of Stock" tone="danger"/> : <Stepper value={qty} onChange={onChange} max={product.stockTracked ? product.stockQty : 100}/>} 
  </View>;
}
const styles=StyleSheet.create({card:{flexDirection:"row",alignItems:"center",gap:12,backgroundColor:"#fff",borderRadius:radius.lg,padding:13,marginBottom:10,borderWidth:1,borderColor:"#DCE9F0",...shadow.card},icon:{width:58,height:58,borderRadius:14,backgroundColor:colors.customerBg,alignItems:"center",justifyContent:"center"},name:{fontFamily:fonts.bodyBold,fontSize:14.5,color:colors.ink},meta:{fontFamily:fonts.body,fontSize:10.5,color:colors.inkSoft,marginTop:2},price:{fontFamily:fonts.displayBold,fontSize:14.5,color:colors.primary,marginTop:4},each:{fontFamily:fonts.body,fontSize:10,color:colors.inkSoft}
});
