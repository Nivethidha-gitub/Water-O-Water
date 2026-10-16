import React from "react";
import Icon from "./Icon";
import { StyleSheet, View } from "react-native";
import { Text } from "../i18n";
import { Card, StatusBadge } from "./ui";
import { colors, fonts, radius } from "../theme/colors";
import { formatDate, itemsSummary, money } from "../utils/format";
function SafeChildren({children}){return React.Children.map(children,c=>(typeof c==="string"||typeof c==="number")?<Text>{String(c)}</Text>:c)}
export default function OrderCard({order,subtitle,onPress,children,showEta=true,supplierView=false}){
 const active=!['delivered','settled','cancelled','failed'].includes(order.status);
 return <Card onPress={onPress} style={styles.card}>
  <View style={styles.top}><View style={styles.orderIcon}><Icon name="package" size={21} /></View><View style={{flex:1}}><Text style={styles.code}>Order #{order.code}</Text><Text style={styles.sub}>{[formatDate(order.createdAt),subtitle].filter(Boolean).join(" · ")}</Text></View><StatusBadge status={order.status} label={supplierView&&order.status==="placed"?"New":undefined}/></View>
  <View style={styles.line}><Text style={styles.items}>{itemsSummary(order)}</Text><Text style={styles.total}>{money(order.totalPaise)}</Text></View>
  {showEta&&active&&order.eta?<View style={styles.eta}><Text style={styles.etaIcon}>⏱</Text><View><Text style={styles.etaLabel}>Expected Delivery</Text><Text style={styles.etaValue}>{order.eta}</Text></View></View>:null}
  <SafeChildren>{children}</SafeChildren>
 </Card>
}
const styles=StyleSheet.create({card:{padding:13},top:{flexDirection:"row",alignItems:"center",gap:10},orderIcon:{width:40,height:40,borderRadius:12,backgroundColor:colors.customerBg,alignItems:"center",justifyContent:"center"},code:{fontFamily:fonts.displayBold,fontSize:14.5,color:colors.primaryDark},sub:{fontFamily:fonts.body,fontSize:11.5,color:colors.inkSoft,marginTop:2},line:{flexDirection:"row",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginTop:11,paddingTop:10,borderTopWidth:1,borderTopColor:"#EDF2F5"},items:{flex:1,fontFamily:fonts.body,fontSize:12.5,color:colors.ink,lineHeight:18},total:{fontFamily:fonts.bodyBold,fontSize:14,color:colors.primaryDark},eta:{flexDirection:"row",alignItems:"center",gap:8,backgroundColor:colors.customerBg,borderRadius:10,padding:9,marginTop:10},etaIcon:{fontSize:14},etaLabel:{fontFamily:fonts.bodyBold,fontSize:9.5,letterSpacing:.45,color:colors.primary},etaValue:{fontFamily:fonts.display,fontSize:13.5,color:colors.primaryDark,marginTop:1}
});
